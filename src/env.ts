/** Best-effort environment checks used by the download consent screen. */

interface NetworkInformationLike {
  saveData?: boolean
  effectiveType?: string
  type?: string
}

export const isMeteredConnection = (
  connection: NetworkInformationLike | undefined = (
    navigator as Navigator & { connection?: NetworkInformationLike }
  ).connection
): boolean =>
  !!connection &&
  (connection.saveData === true ||
    connection.type === 'cellular' ||
    ['slow-2g', '2g', '3g'].includes(connection.effectiveType ?? ''))

/**
 * True on iOS/iPadOS when running in the browser rather than as an installed
 * home-screen app, where Safari may evict site storage.
 */
export const shouldSuggestInstall = (
  userAgent: string = navigator.userAgent,
  maxTouchPoints: number = navigator.maxTouchPoints,
  standalone: boolean = (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches)
): boolean => {
  // iPadOS reports a desktop Mac user agent, but has touch points.
  const isIos = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)

  return isIos && !standalone
}

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
