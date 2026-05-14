'use client'

import { createContext, useContext, useState } from 'react'

type ExportFn = (() => void) | null

interface LessonExportCtx {
  exportFn: ExportFn
  setExportFn: (fn: ExportFn) => void
}

const LessonExportContext = createContext<LessonExportCtx>({
  exportFn: null,
  setExportFn: () => {},
})

export function LessonExportProvider({ children }: { children: React.ReactNode }) {
  const [exportFn, setExportFn] = useState<ExportFn>(null)
  return (
    <LessonExportContext.Provider value={{ exportFn, setExportFn }}>
      {children}
    </LessonExportContext.Provider>
  )
}

export function useLessonExport() {
  return useContext(LessonExportContext)
}
