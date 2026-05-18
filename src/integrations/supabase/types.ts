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
      app_modules: {
        Row: {
          beschreibung: string | null
          created_at: string
          enabled: boolean
          id: string
          is_global: boolean
          key: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          beschreibung?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          is_global?: boolean
          key: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          beschreibung?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          is_global?: boolean
          key?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          budeko_notiz: string | null
          dashboard_hinweis: string | null
          domain_id: string
          firmenname: string
          logo_url: string | null
          rohrservice_notiz: string | null
          rohrservice_variante: string
          theme: string
          updated_at: string
          updated_by: string | null
          wartung_aktiv: boolean
          wartung_farbe: string
          wartung_nachricht: string | null
        }
        Insert: {
          budeko_notiz?: string | null
          dashboard_hinweis?: string | null
          domain_id: string
          firmenname?: string
          logo_url?: string | null
          rohrservice_notiz?: string | null
          rohrservice_variante?: string
          theme?: string
          updated_at?: string
          updated_by?: string | null
          wartung_aktiv?: boolean
          wartung_farbe?: string
          wartung_nachricht?: string | null
        }
        Update: {
          budeko_notiz?: string | null
          dashboard_hinweis?: string | null
          domain_id?: string
          firmenname?: string
          logo_url?: string | null
          rohrservice_notiz?: string | null
          rohrservice_variante?: string
          theme?: string
          updated_at?: string
          updated_by?: string | null
          wartung_aktiv?: boolean
          wartung_farbe?: string
          wartung_nachricht?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: true
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      app_versions: {
        Row: {
          changelog: string | null
          created_at: string
          created_by: string | null
          id: string
          released_at: string
          version: string
        }
        Insert: {
          changelog?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          released_at?: string
          version: string
        }
        Update: {
          changelog?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          released_at?: string
          version?: string
        }
        Relationships: []
      }
      budeko_berichte: {
        Row: {
          anrufer_adresse: string | null
          anrufer_firma: string | null
          anrufer_name: string | null
          anrufer_telefon: string | null
          bericht_nr: number
          created_at: string
          created_by: string | null
          diensthabender_alarmzentrale: string | null
          domain_id: string
          id: string
          mieter_name: string | null
          mieter_ort: string | null
          mieter_strasse: string | null
          mieter_telefon: string | null
          monteur_weitergabe: string | null
          stoerungsart: string | null
          updated_at: string
          versendet: boolean
          versendet_am: string | null
          versendet_an: string | null
          weiterleitung: string | null
          zeit_kundenanruf: string | null
          zeit_weitergabe: string | null
        }
        Insert: {
          anrufer_adresse?: string | null
          anrufer_firma?: string | null
          anrufer_name?: string | null
          anrufer_telefon?: string | null
          bericht_nr?: number
          created_at?: string
          created_by?: string | null
          diensthabender_alarmzentrale?: string | null
          domain_id: string
          id?: string
          mieter_name?: string | null
          mieter_ort?: string | null
          mieter_strasse?: string | null
          mieter_telefon?: string | null
          monteur_weitergabe?: string | null
          stoerungsart?: string | null
          updated_at?: string
          versendet?: boolean
          versendet_am?: string | null
          versendet_an?: string | null
          weiterleitung?: string | null
          zeit_kundenanruf?: string | null
          zeit_weitergabe?: string | null
        }
        Update: {
          anrufer_adresse?: string | null
          anrufer_firma?: string | null
          anrufer_name?: string | null
          anrufer_telefon?: string | null
          bericht_nr?: number
          created_at?: string
          created_by?: string | null
          diensthabender_alarmzentrale?: string | null
          domain_id?: string
          id?: string
          mieter_name?: string | null
          mieter_ort?: string | null
          mieter_strasse?: string | null
          mieter_telefon?: string | null
          monteur_weitergabe?: string | null
          stoerungsart?: string | null
          updated_at?: string
          versendet?: boolean
          versendet_am?: string | null
          versendet_an?: string | null
          weiterleitung?: string | null
          zeit_kundenanruf?: string | null
          zeit_weitergabe?: string | null
        }
        Relationships: []
      }
      budeko_mitarbeiter: {
        Row: {
          aktiv: boolean
          created_at: string
          created_by: string | null
          domain_id: string
          id: string
          name: string
          telefon_1: string | null
          telefon_2: string | null
          updated_at: string
        }
        Insert: {
          aktiv?: boolean
          created_at?: string
          created_by?: string | null
          domain_id: string
          id?: string
          name: string
          telefon_1?: string | null
          telefon_2?: string | null
          updated_at?: string
        }
        Update: {
          aktiv?: boolean
          created_at?: string
          created_by?: string | null
          domain_id?: string
          id?: string
          name?: string
          telefon_1?: string | null
          telefon_2?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      budeko_notdienst: {
        Row: {
          bis: string
          created_at: string
          created_by: string | null
          domain_id: string
          id: string
          mitarbeiter_id: string
          updated_at: string
          von: string
        }
        Insert: {
          bis: string
          created_at?: string
          created_by?: string | null
          domain_id: string
          id?: string
          mitarbeiter_id: string
          updated_at?: string
          von: string
        }
        Update: {
          bis?: string
          created_at?: string
          created_by?: string | null
          domain_id?: string
          id?: string
          mitarbeiter_id?: string
          updated_at?: string
          von?: string
        }
        Relationships: [
          {
            foreignKeyName: "budeko_notdienst_mitarbeiter_id_fkey"
            columns: ["mitarbeiter_id"]
            isOneToOne: false
            referencedRelation: "budeko_mitarbeiter"
            referencedColumns: ["id"]
          },
        ]
      }
      budeko_notiz_dateien: {
        Row: {
          created_at: string
          created_by: string | null
          domain_id: string
          id: string
          label: string
          mime_type: string | null
          size_bytes: number | null
          sort_order: number
          storage_path: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          domain_id: string
          id?: string
          label: string
          mime_type?: string | null
          size_bytes?: number | null
          sort_order?: number
          storage_path: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          domain_id?: string
          id?: string
          label?: string
          mime_type?: string | null
          size_bytes?: number | null
          sort_order?: number
          storage_path?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          created_at: string
          created_by: string | null
          domain_id: string
          id: string
          kind: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          domain_id: string
          id?: string
          kind: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          domain_id?: string
          id?: string
          kind?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          attachment_mime: string | null
          attachment_name: string | null
          attachment_path: string | null
          attachment_size: number | null
          body: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          domain_id: string
          edited_at: string | null
          id: string
          sender_id: string
        }
        Insert: {
          attachment_mime?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          body?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          domain_id: string
          edited_at?: string | null
          id?: string
          sender_id: string
        }
        Update: {
          attachment_mime?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          body?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          domain_id?: string
          edited_at?: string | null
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          conversation_id: string
          domain_id: string
          joined_at: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          domain_id: string
          joined_at?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          domain_id?: string
          joined_at?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      datei_historie: {
        Row: {
          changed_at: string
          changed_by: string | null
          datei_id: string
          domain_id: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          datei_id: string
          domain_id: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          datei_id?: string
          domain_id?: string
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
          {
            foreignKeyName: "datei_historie_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
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
          domain_id: string
          id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          datei_a_id: string
          datei_b_id: string
          domain_id: string
          id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          datei_a_id?: string
          datei_b_id?: string
          domain_id?: string
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
          {
            foreignKeyName: "datei_verknuepfungen_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
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
          domain_id: string
          filename: string
          folder: string | null
          id: string
          key_number: string | null
          kunden_name: string | null
          mime_type: string | null
          notiz: string | null
          size_bytes: number | null
          storage_path: string | null
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
          domain_id: string
          filename: string
          folder?: string | null
          id?: string
          key_number?: string | null
          kunden_name?: string | null
          mime_type?: string | null
          notiz?: string | null
          size_bytes?: number | null
          storage_path?: string | null
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
          domain_id?: string
          filename?: string
          folder?: string | null
          id?: string
          key_number?: string | null
          kunden_name?: string | null
          mime_type?: string | null
          notiz?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          teilnehmer_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dateien_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_modules: {
        Row: {
          created_at: string
          domain_id: string
          enabled: boolean
          module_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain_id: string
          enabled?: boolean
          module_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain_id?: string
          enabled?: boolean
          module_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "domain_modules_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      domains: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      driver_locations: {
        Row: {
          accuracy: number | null
          domain_id: string
          heading: number | null
          lat: number
          lng: number
          speed: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          domain_id: string
          heading?: number | null
          lat: number
          lng: number
          speed?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy?: number | null
          domain_id?: string
          heading?: number | null
          lat?: number
          lng?: number
          speed?: number | null
          updated_at?: string
          user_id?: string
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
          domain_id: string
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
          storniert_at: string | null
          storniert_by: string | null
          storniert_grund: string | null
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
          domain_id: string
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
          storniert_at?: string | null
          storniert_by?: string | null
          storniert_grund?: string | null
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
          domain_id?: string
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
          storniert_at?: string | null
          storniert_by?: string | null
          storniert_grund?: string | null
          teilnehmer_id?: string | null
          updated_at?: string
          vor_ort_am?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "einsaetze_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
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
          domain_id: string
          einsatz_id: string
          error_message: string | null
          id: string
          recipient_email: string
          sent_at: string
          sent_by: string | null
          status: string
        }
        Insert: {
          domain_id: string
          einsatz_id: string
          error_message?: string | null
          id?: string
          recipient_email: string
          sent_at?: string
          sent_by?: string | null
          status?: string
        }
        Update: {
          domain_id?: string
          einsatz_id?: string
          error_message?: string | null
          id?: string
          recipient_email?: string
          sent_at?: string
          sent_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "einsatz_email_log_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      einsatz_gruende: {
        Row: {
          aktiv: boolean
          created_at: string
          created_by: string | null
          domain_id: string
          id: string
          name: string
        }
        Insert: {
          aktiv?: boolean
          created_at?: string
          created_by?: string | null
          domain_id: string
          id?: string
          name: string
        }
        Update: {
          aktiv?: boolean
          created_at?: string
          created_by?: string | null
          domain_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "einsatz_gruende_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      einsatz_historie: {
        Row: {
          changed_at: string
          changed_by: string | null
          domain_id: string
          einsatz_id: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          domain_id: string
          einsatz_id: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          domain_id?: string
          einsatz_id?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "einsatz_historie_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "einsatz_historie_einsatz_id_fkey"
            columns: ["einsatz_id"]
            isOneToOne: false
            referencedRelation: "einsaetze"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      intrahub_posts: {
        Row: {
          attachments: Json
          content: string
          created_at: string
          created_by: string
          domain_id: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          attachments?: Json
          content?: string
          created_at?: string
          created_by: string
          domain_id: string
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          attachments?: Json
          content?: string
          created_at?: string
          created_by?: string
          domain_id?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      licenses: {
        Row: {
          created_at: string
          domain_id: string
          id: string
          license_key: string
          max_users: number | null
          notes: string | null
          status: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          domain_id: string
          id?: string
          license_key: string
          max_users?: number | null
          notes?: string | null
          status?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          domain_id?: string
          id?: string
          license_key?: string
          max_users?: number | null
          notes?: string | null
          status?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "licenses_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          current_version: string
          id: number
          updated_at: string
          updated_by: string | null
          wartung_aktiv: boolean
          wartung_farbe: string
          wartung_nachricht: string | null
        }
        Insert: {
          current_version?: string
          id?: number
          updated_at?: string
          updated_by?: string | null
          wartung_aktiv?: boolean
          wartung_farbe?: string
          wartung_nachricht?: string | null
        }
        Update: {
          current_version?: string
          id?: number
          updated_at?: string
          updated_by?: string | null
          wartung_aktiv?: boolean
          wartung_farbe?: string
          wartung_nachricht?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          domain_id: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          domain_id?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          domain_id?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      rohrservice_berichte: {
        Row: {
          anrufer_adresse: string | null
          anrufer_firma: string | null
          anrufer_name: string | null
          anrufer_telefon: string | null
          bericht_nr: number
          created_at: string
          created_by: string | null
          diensthabender_alarmzentrale: string | null
          domain_id: string
          id: string
          mieter_name: string | null
          mieter_ort: string | null
          mieter_strasse: string | null
          mieter_telefon: string | null
          monteur_rueckmeldung: string | null
          monteur_weitergabe: string | null
          rechnung_adresse: string | null
          rechnung_name: string | null
          rechnung_telefon: string | null
          stoerungsart: string | null
          updated_at: string
          versendet: boolean
          versendet_am: string | null
          versendet_an: string | null
          weiterleitung: string | null
          zeit_kundenanruf: string | null
          zeit_rueckmeldung: string | null
          zeit_weitergabe: string | null
        }
        Insert: {
          anrufer_adresse?: string | null
          anrufer_firma?: string | null
          anrufer_name?: string | null
          anrufer_telefon?: string | null
          bericht_nr?: number
          created_at?: string
          created_by?: string | null
          diensthabender_alarmzentrale?: string | null
          domain_id: string
          id?: string
          mieter_name?: string | null
          mieter_ort?: string | null
          mieter_strasse?: string | null
          mieter_telefon?: string | null
          monteur_rueckmeldung?: string | null
          monteur_weitergabe?: string | null
          rechnung_adresse?: string | null
          rechnung_name?: string | null
          rechnung_telefon?: string | null
          stoerungsart?: string | null
          updated_at?: string
          versendet?: boolean
          versendet_am?: string | null
          versendet_an?: string | null
          weiterleitung?: string | null
          zeit_kundenanruf?: string | null
          zeit_rueckmeldung?: string | null
          zeit_weitergabe?: string | null
        }
        Update: {
          anrufer_adresse?: string | null
          anrufer_firma?: string | null
          anrufer_name?: string | null
          anrufer_telefon?: string | null
          bericht_nr?: number
          created_at?: string
          created_by?: string | null
          diensthabender_alarmzentrale?: string | null
          domain_id?: string
          id?: string
          mieter_name?: string | null
          mieter_ort?: string | null
          mieter_strasse?: string | null
          mieter_telefon?: string | null
          monteur_rueckmeldung?: string | null
          monteur_weitergabe?: string | null
          rechnung_adresse?: string | null
          rechnung_name?: string | null
          rechnung_telefon?: string | null
          stoerungsart?: string | null
          updated_at?: string
          versendet?: boolean
          versendet_am?: string | null
          versendet_an?: string | null
          weiterleitung?: string | null
          zeit_kundenanruf?: string | null
          zeit_rueckmeldung?: string | null
          zeit_weitergabe?: string | null
        }
        Relationships: []
      }
      rohrservice_mitarbeiter: {
        Row: {
          aktiv: boolean
          created_at: string
          created_by: string | null
          domain_id: string
          id: string
          name: string
          telefon_1: string | null
          telefon_2: string | null
          updated_at: string
        }
        Insert: {
          aktiv?: boolean
          created_at?: string
          created_by?: string | null
          domain_id: string
          id?: string
          name: string
          telefon_1?: string | null
          telefon_2?: string | null
          updated_at?: string
        }
        Update: {
          aktiv?: boolean
          created_at?: string
          created_by?: string | null
          domain_id?: string
          id?: string
          name?: string
          telefon_1?: string | null
          telefon_2?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rohrservice_notdienst: {
        Row: {
          bis: string
          created_at: string
          created_by: string | null
          domain_id: string
          id: string
          mitarbeiter_id: string
          updated_at: string
          von: string
        }
        Insert: {
          bis: string
          created_at?: string
          created_by?: string | null
          domain_id: string
          id?: string
          mitarbeiter_id: string
          updated_at?: string
          von: string
        }
        Update: {
          bis?: string
          created_at?: string
          created_by?: string | null
          domain_id?: string
          id?: string
          mitarbeiter_id?: string
          updated_at?: string
          von?: string
        }
        Relationships: [
          {
            foreignKeyName: "rohrservice_notdienst_mitarbeiter_id_fkey"
            columns: ["mitarbeiter_id"]
            isOneToOne: false
            referencedRelation: "rohrservice_mitarbeiter"
            referencedColumns: ["id"]
          },
        ]
      }
      rohrservice_notiz_dateien: {
        Row: {
          created_at: string
          created_by: string | null
          domain_id: string
          id: string
          label: string
          mime_type: string | null
          size_bytes: number | null
          sort_order: number
          storage_path: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          domain_id: string
          id?: string
          label: string
          mime_type?: string | null
          size_bytes?: number | null
          sort_order?: number
          storage_path: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          domain_id?: string
          id?: string
          label?: string
          mime_type?: string | null
          size_bytes?: number | null
          sort_order?: number
          storage_path?: string
          updated_at?: string
        }
        Relationships: []
      }
      superadmin_impersonation: {
        Row: {
          started_at: string
          superadmin_id: string
          target_domain_id: string
        }
        Insert: {
          started_at?: string
          superadmin_id: string
          target_domain_id: string
        }
        Update: {
          started_at?: string
          superadmin_id?: string
          target_domain_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "superadmin_impersonation_target_domain_id_fkey"
            columns: ["target_domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          domain_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          domain_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          domain_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_conversation: { Args: { _conv_id: string }; Returns: boolean }
      current_effective_domain_id: { Args: never; Returns: string }
      current_user_domain_id: { Args: never; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_or_create_dm: { Args: { _other_user: string }; Returns: string }
      get_or_create_domain_channel: { Args: never; Returns: string }
      has_active_license: { Args: { _domain_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_domain_admin: { Args: { _domain_id: string }; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "dispatcher" | "fahrer" | "superadmin" | "user"
      einsatz_prioritaet: "niedrig" | "normal" | "hoch" | "kritisch"
      einsatz_status:
        | "entwurf"
        | "wartet_freigabe"
        | "freigegeben"
        | "abgelehnt"
        | "in_bearbeitung"
        | "abgeschlossen"
        | "storniert"
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
      app_role: ["admin", "dispatcher", "fahrer", "superadmin", "user"],
      einsatz_prioritaet: ["niedrig", "normal", "hoch", "kritisch"],
      einsatz_status: [
        "entwurf",
        "wartet_freigabe",
        "freigegeben",
        "abgelehnt",
        "in_bearbeitung",
        "abgeschlossen",
        "storniert",
      ],
    },
  },
} as const
