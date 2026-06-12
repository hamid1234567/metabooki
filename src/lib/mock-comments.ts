export type CommentStatus = 'visible' | 'hidden'

export interface MockComment {
  id: string
  bookId: string
  userId: string
  displayName: string
  text: string
  status: CommentStatus
  createdAt: string
}

const COMMENTS_KEY = 'metabooki_mock_comments'

function readComments(): MockComment[] {
  try {
    const raw = localStorage.getItem(COMMENTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeComments(comments: MockComment[]) {
  localStorage.setItem(COMMENTS_KEY, JSON.stringify(comments))
}

export function getAllComments() {
  return readComments().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function getBookComments(bookId: string, visibleOnly = true) {
  return readComments()
    .filter(c => c.bookId === bookId && (!visibleOnly || c.status === 'visible'))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function addBookComment(input: Omit<MockComment, 'id' | 'status' | 'createdAt'>) {
  const comments = readComments()
  const comment: MockComment = {
    ...input,
    id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: 'visible',
    createdAt: new Date().toISOString(),
  }
  comments.unshift(comment)
  writeComments(comments)
  return comment
}

export function updateCommentStatus(id: string, status: CommentStatus) {
  const comments = readComments().map(c => c.id === id ? { ...c, status } : c)
  writeComments(comments)
  return comments.find(c => c.id === id) || null
}

export function deleteComment(id: string) {
  writeComments(readComments().filter(c => c.id !== id))
}
