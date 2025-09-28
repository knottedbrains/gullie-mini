// Minimal supabase placeholder. Replace with a real client when Supabase credentials are wired up.
const supabaseStub = {
  from() {
    return {
      select() {
        return {
          eq() {
            return {
              async maybeSingle() {
                return { data: null, error: null }
              },
            }
          },
        }
      },
      async upsert() {
        return { error: new Error('Supabase client not configured') }
      },
    }
  },
} as const

export const supabase: any = supabaseStub
