// Temporary fix for the "read" module since type definitions from npm is outdated

declare module "read" {
  interface Options {
    prompt?: string | undefined
    silent?: boolean | undefined
    replace?: string | undefined
    timeout?: number | undefined
    default?: string | undefined
    edit?: boolean | undefined
    terminal?: boolean | undefined
    input?: any
    output?: any
  }

  declare function Read(options: Options): Promise<string>

  export = Read
}
