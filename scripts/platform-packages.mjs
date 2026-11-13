// One release contract for archive filenames, verification and marketplace URL fields.
const variants = [
  { platform:'windows', arch:'x64', suffix:'windows', field:'packageUrlWindows' },
  { platform:'windows', arch:'arm64', suffix:'windows-arm', field:'packageUrlWindowsArm' },
  { platform:'macos', arch:'arm64', suffix:'macos', field:'packageUrlMacos' },
  { platform:'macos', arch:'x64', suffix:'macos-intel', field:'packageUrlMacosIntel' },
  { platform:'linux', arch:'x64', suffix:'linux', field:'packageUrlLinux' },
  { platform:'linux', arch:'arm64', suffix:'linux-arm', field:'packageUrlLinuxArm' },
]
export function platformVariants() { return variants.map(variant => ({...variant})) }
export function platformVariant(platform, arch) {
  const selected=variants.find(variant=>variant.platform===platform && variant.arch===arch)
  if(!selected)throw new Error('不支持的平台或架构，支持 Windows/macOS/Linux × x64/arm64')
  return {...selected}
}
