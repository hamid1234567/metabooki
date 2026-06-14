declare module 'utif' {
  interface TiffDirectory {
    width: number
    height: number
    data?: Uint8Array
  }

  const UTIF: {
    decode(buffer: ArrayBuffer): TiffDirectory[]
    decodeImage(buffer: ArrayBuffer, directory: TiffDirectory): void
    toRGBA8(directory: TiffDirectory): Uint8Array
  }

  export default UTIF
}
