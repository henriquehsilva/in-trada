export {}

declare global {
  // flags para evitar chamada dupla em DEV/HMR
  var _emu_fs: boolean | undefined
  var _emu_auth: boolean | undefined
  var _emu_st: boolean | undefined
  var _fsPersistence: boolean | undefined
}
