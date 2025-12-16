// Tipos gerados pelo Supabase CLI
// Execute: npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/supabase.ts
// Por enquanto, tipos básicos

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      atendimentos: {
        Row: {
          id: string
          cliente_id: string
          status: 'aberto' | 'em_andamento' | 'encerrado'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          cliente_id: string
          status?: 'aberto' | 'em_andamento' | 'encerrado'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          cliente_id?: string
          status?: 'aberto' | 'em_andamento' | 'encerrado'
          created_at?: string
          updated_at?: string
        }
      }
      mensagens: {
        Row: {
          id: string
          atendimento_id: string
          conteudo: string
          tipo: 'humano' | 'bot'
          created_at: string
        }
        Insert: {
          id?: string
          atendimento_id: string
          conteudo: string
          tipo: 'humano' | 'bot'
          created_at?: string
        }
        Update: {
          id?: string
          atendimento_id?: string
          conteudo?: string
          tipo?: 'humano' | 'bot'
          created_at?: string
        }
      }
    }
  }
}







