/** Solo testing: dev o `VITE_ENABLE_DUMMY_DATA=true`. */
export function isDummyResultsSeedEnabled(): boolean {
  return Boolean(import.meta.env.DEV || import.meta.env.VITE_ENABLE_DUMMY_DATA === 'true')
}
