export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      datei_historie: {
        Row: {
          changed_at: string
          changed_by: string | null
          datei_id: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          datei_id: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          datei_id?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "datei_historie_datei_id_fkey"
            columns: ["datei_id"]
            isOneToOne: false
            referencedRelation: "dateien"
            referencedColumns: ["id"]
          },
        ]
      }
      datei_verknuepfungen: {
        Row: {
          created_at: string
          created_by: string | null
          datei_a_id: string
          datei_b_id: string
          id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          datei_a_id: string
          datei_b_id: string
          id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          datei_a_id?: string
          datei_b_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "datei_verknuepfungen_datei_a_id_fkey"
            columns: ["datei_a_id"]
            isOneToOne: false
            referencedRelation: "dateien"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "datei_verknuepfungen_datei_b_id_fkey"
            columns: ["datei_b_id"]
            isOneToOne: false
            referencedRelation: "dateien"
            referencedColumns: ["id"]
          },
        ]
      }
      dateien: {
        Row: {
          address: string | null
          anlagen_nr: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          filename: string
          folder: string | null
          id: string
          key_number: string | null
          kunden_name: string | null
          mime_type: string | null
          notiz: string | null
          size_bytes: number | null
          storage_path: string
          teilnehmer_id: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          address?: string | null
          anlagen_nr?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          filename: string
          folder?: string | null
          id?: string
          key_number?: string | null
          kunden_name?: string | null
          mime_type?: string | null
          notiz?: string | null
          size_bytes?: number | null
          storage_path: string
          teilnehmer_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          address?: string | null
          anlagen_nr?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          filename?: string
          folder?: string | null
          id?: string
          key_number?: string | null
          kunden_name?: string | null
          mime_type?: string | null
          notiz?: string | null
          size_bytes?: number | null
          storage_path?: string
          teilnehmer_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      einsaetze: {
        Row: {
          abfahrt_am: string | null
          abgeschlossen_am: string | null
          ablehnung_grund: string | null
          address: string | null
          anlagen_nr: string | null
          approved_at: string | null
          approved_by: string | null
          assigned_at: string | null
          assigned_to: string | null
          bericht_data: Json | null
          bericht_typ: string | null
          beschreibung: string | null
          created_at: string
          created_by: string
          einsatz_ende_am: string | null
          einsatzgrund: string
          einsatzgrund_id: string | null
          geplant_am: string | null
          hausnotruf_loesung: string | null
          hausnotruf_problem: string | null
          id: string
          key_number: string | null
          kunden_email: string | null
          kunden_name: string | null
          prioritaet: Database["public"]["Enums"]["einsatz_prioritaet"]
          status: Database["public"]["Enums"]["einsatz_status"]
          teilnehmer_id: string | null
          updated_at: string
          vor_ort_am: string | null
        }
        Insert: {
          abfahrt_am?: string | null
          abgeschlossen_am?: string | null
          ablehnung_grund?: string | null
          address?: string | null
          anlagen_nr?: string | null
          approved_at?: string | null
          approved_by?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          bericht_data?: Json | null
          bericht_typ?: string | null
          beschreibung?: string | null
          created_at?: string
          created_by: string
          einsatz_ende_am?: string | null
          einsatzgrund: string
          einsatzgrund_id?: string | null
          geplant_am?: string | null
          hausnotruf_loesung?: string | null
          hausnotruf_problem?: string | null
          id?: string
          key_number?: string | null
          kunden_email?: string | null
          kunden_name?: string | null
          prioritaet?: Database["public"]["Enums"]["einsatz_prioritaet"]
          status?: Database["public"]["Enums"]["einsatz_status"]
          teilnehmer_id?: string | null
          updated_at?: string
          vor_ort_am?: string | null
        }
        Update: {
          abfahrt_am?: string | null
          abgeschlossen_am?: string | null
          ablehnung_grund?: string | null
          address?: string | null
          anlagen_nr?: string | null
          approved_at?: string | null
          approved_by?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          bericht_data?: Json | null
          bericht_typ?: string | null
          beschreibung?: string | null
          created_at?: string
          created_by?: string
          einsatz_ende_am?: string | null
          einsatzgrund?: string
          einsatzgrund_id?: string | null
          geplant_am?: string | null
          hausnotruf_loesung?: string | null
          hausnotruf_problem?: string | null
          id?: string
          key_number?: string | null
          kunden_email?: string | null
          kunden_name?: string | null
          prioritaet?: Database["public"]["Enums"]["einsatz_prioritaet"]
          status?: Database["public"]["Enums"]["einsatz_status"]
          teilnehmer_id?: string | null
          updated_at?: string
          vor_ort_am?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "einsaetze_einsatzgrund_id_fkey"
            columns: ["einsatzgrund_id"]
            isOneToOne: false
            referencedRelation: "einsatz_gruende"
            referencedColumns: ["id"]
          },
        ]
      }
      einsatz_email_log: {
        Row: {
          einsatz_id: string
          error_message: string | null
          id: string
          recipient_email: string
          sent_at: string
          sent_by: string | null
          status: string
        }
        Insert: {
          einsatz_id: string
          error_message?: string | null
          id?: string
          recipient_email: string
          sent_at?: string
          sent_by?: string | null
          status?: string
        }
        Update: {
          einsatz_id?: string
          error_message?: string | null
          id?: string
          recipient_email?: string
          sent_at?: string
          sent_by?: string | null
          status?: string
        }
        Relationships: []
      }
      einsatz_gruende: {
        Row: {
          aktiv: boolean
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          aktiv?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          aktiv?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      einsatz_historie: {
        Row: {
          changed_at: string
          changed_by: string | null
          einsatz_id: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          einsatz_id: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          einsatz_id?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "einsatz_historie_einsatz_id_fkey"
            columns: ["einsatz_id"]
            isOneToOne: false
            referencedRelation: "einsaetze"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "dispatcher" | "fahrer"
      einsatz_prioritaet: "niedrig" | "normal" | "hoch" | "kritisch"
      einsatz_status:
        | "entwurf"
        | "wartet_freigabe"
        | "freigegeben"
        | "abgelehnt"
        | "in_bearbeitung"
        | "abgeschlossen"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "dispatcher", "fahrer"],
      einsatz_prioritaet: ["niedrig", "normal", "hoch", "kritisch"],
      einsatz_status: [
        "entwurf",
        "wartet_freigabe",
        "freigegeben",
        "abgelehnt",
        "in_bearbeitung",
        "abgeschlossen",
      ],
    },
  },
} as const
