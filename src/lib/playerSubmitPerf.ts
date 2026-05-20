/** En DEV: `localStorage.setItem('perfPlayerSubmit','1')` para logs de submit/recálculo/UI. */
export function isPlayerSubmitPerfEnabled(): boolean {
  return (
    import.meta.env.DEV &&
    typeof localStorage !== 'undefined' &&
    localStorage.getItem('perfPlayerSubmit') === '1'
  )
}
