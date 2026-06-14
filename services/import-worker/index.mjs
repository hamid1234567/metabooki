import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import JSZip from 'jszip'

const exec = promisify(execFile)
const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const interval = Number(process.env.POLL_INTERVAL_MS || 5000)
if (!url || !serviceKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function updateJob(id, patch) {
  const { error } = await supabase.from('book_import_jobs').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

async function updateProject(id, patch) {
  const { error } = await supabase.from('book_import_projects').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

async function claimJob() {
  const { data, error } = await supabase.from('book_import_jobs').select('*,book_import_projects(*)').eq('status', 'queued').order('created_at').limit(1).maybeSingle()
  if (error) throw error
  if (!data) return null
  const { data: claimed, error: claimError } = await supabase.from('book_import_jobs')
    .update({ status: 'processing', locked_at: new Date().toISOString(), attempts: data.attempts + 1 })
    .eq('id', data.id).eq('status', 'queued').select('id').maybeSingle()
  if (claimError) throw claimError
  return claimed ? data : null
}

async function downloadSource(project, directory) {
  const folder = `${project.owner_id}/${project.id}/source`
  const { data: entries, error } = await supabase.storage.from('book-imports').list(folder, { limit: 1000, sortBy: { column: 'name', order: 'asc' } })
  if (error) throw error
  if (!entries?.length) throw new Error('No source chunks were uploaded.')
  const chunks = []
  for (const entry of entries.filter(item => item.name.endsWith('.part'))) {
    const { data, error: chunkError } = await supabase.storage.from('book-imports').download(`${folder}/${entry.name}`)
    if (chunkError) throw chunkError
    chunks.push(Buffer.from(await data.arrayBuffer()))
  }
  const source = Buffer.concat(chunks)
  const checksum = createHash('sha256').update(source).digest('hex')
  if (checksum !== project.source_checksum) throw new Error('Source checksum does not match the confirmed local file.')
  const path = join(directory, 'source.docx')
  await writeFile(path, source)
  return { path, source }
}

async function validateDocx(source, localAnalysis) {
  const zip = await JSZip.loadAsync(source)
  if (!zip.file('word/document.xml')) throw new Error('Uploaded package is not a valid DOCX document.')
  const mediaCount = Object.keys(zip.files).filter(name => name.startsWith('word/media/') && !zip.files[name].dir).length
  const localMediaCount = Number(localAnalysis?.stats?.images || 0)
  return {
    valid: true,
    mediaCount,
    localMediaCount,
    differences: mediaCount === localMediaCount ? [] : [{ code: 'image-count', local: localMediaCount, server: mediaCount }],
  }
}

async function makeReferencePdf(sourcePath, directory) {
  try {
    await exec('libreoffice', ['--headless', '--convert-to', 'pdf', '--outdir', directory, sourcePath], { timeout: 180000 })
    const pdf = (await readdir(directory)).find(name => name.endsWith('.pdf'))
    return pdf ? join(directory, pdf) : null
  } catch {
    return null
  }
}

async function uploadArtifact(project, path, name, contentType) {
  const content = await readFile(path)
  const target = `${project.owner_id}/${project.id}/artifacts/${name}`
  const { error } = await supabase.storage.from('book-imports').upload(target, content, { upsert: true, contentType })
  if (error) throw error
  return target
}

async function processJob(job) {
  const project = job.book_import_projects
  const directory = await mkdtemp(join(tmpdir(), 'metabooki-import-'))
  try {
    await updateProject(project.id, { status: 'processing' })
    await updateJob(job.id, { progress: 10 })
    const { path, source } = await downloadSource(project, directory)
    await updateJob(job.id, { progress: 40 })
    const serverAnalysis = await validateDocx(source, project.local_analysis)
    const sourcePath = await uploadArtifact(project, path, 'source.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    await updateJob(job.id, { progress: 65 })
    const pdfPath = await makeReferencePdf(path, directory)
    const pdfStoragePath = pdfPath ? await uploadArtifact(project, pdfPath, 'reference.pdf', 'application/pdf') : null
    const needsReview = serverAnalysis.differences.length > 0
    await updateProject(project.id, {
      status: needsReview ? 'needs_review' : 'ready',
      server_analysis: { ...serverAnalysis, sourcePath, pdfStoragePath },
      conversion_diff: serverAnalysis.differences,
    })
    await updateJob(job.id, { status: 'completed', progress: 100, result: { sourcePath, pdfStoragePath, needsReview } })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

async function main() {
  for (;;) {
    try {
      const job = await claimJob()
      if (!job) {
        await sleep(interval)
        continue
      }
      try {
        await processJob(job)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await updateJob(job.id, { status: 'failed', error_message: message })
        await updateProject(job.project_id, { status: 'failed', error_message: message })
      }
    } catch (error) {
      console.error(new Date().toISOString(), error)
      await sleep(interval)
    }
  }
}

main()
