export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string | null
          username: string | null
          avatar_url: string | null
          bio: string | null
          phone: string | null
          national_id: string | null
          address_province: string | null
          address_city: string | null
          address_district: string | null
          address_street: string | null
          address_alley: string | null
          address_plaque: string | null
          address_unit: string | null
          postal_code: string | null
          address_notes: string | null
          reading_interests: string[]
          bank_card_number: string | null
          bank_iban: string | null
          is_active: boolean
          phone_verified: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          username?: string | null
          avatar_url?: string | null
          bio?: string | null
          phone?: string | null
          national_id?: string | null
          address_province?: string | null
          address_city?: string | null
          address_district?: string | null
          address_street?: string | null
          address_alley?: string | null
          address_plaque?: string | null
          address_unit?: string | null
          postal_code?: string | null
          address_notes?: string | null
          reading_interests?: string[]
          bank_card_number?: string | null
          bank_iban?: string | null
          is_active?: boolean
          phone_verified?: boolean
        }
        Update: {
          display_name?: string | null
          username?: string | null
          avatar_url?: string | null
          bio?: string | null
          phone?: string | null
          national_id?: string | null
          address_province?: string | null
          address_city?: string | null
          address_district?: string | null
          address_street?: string | null
          address_alley?: string | null
          address_plaque?: string | null
          address_unit?: string | null
          postal_code?: string | null
          address_notes?: string | null
          reading_interests?: string[]
          bank_card_number?: string | null
          bank_iban?: string | null
          is_active?: boolean
          phone_verified?: boolean
        }
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: 'super_admin' | 'admin' | 'moderator' | 'reviewer' | 'publisher' | 'editor' | 'user'
          granted_by: string | null
          created_at: string
        }
        Insert: {
          user_id: string
          role: 'super_admin' | 'admin' | 'moderator' | 'reviewer' | 'publisher' | 'editor' | 'user'
          granted_by?: string | null
        }
        Update: {
          role?: 'super_admin' | 'admin' | 'moderator' | 'reviewer' | 'publisher' | 'editor' | 'user'
        }
      }
      books: {
        Row: {
          id: string
          title: string
          subtitle: string | null
          description: string | null
          cover_url: string | null
          back_cover_url: string | null
          cover_spread_url: string | null
          cover_crop: Json | null
          pages: Json[] | null
          preview_pages: number[] | null
          price: number
          status: 'draft' | 'published'
          review_status: 'pending' | 'approved' | 'rejected'
          publisher_id: string
          content_version: number
          content_updated_at: string
          first_published_paid: boolean
          publish_complexity_factor: number
          series_id: string | null
          series_order: number | null
          language: string
          tags: string[]
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          title: string
          subtitle?: string | null
          description?: string | null
          cover_url?: string | null
          back_cover_url?: string | null
          cover_spread_url?: string | null
          cover_crop?: Json | null
          pages?: Json[] | null
          preview_pages?: number[] | null
          price?: number
          status?: 'draft' | 'published'
          review_status?: 'pending' | 'approved' | 'rejected'
          publisher_id: string
          content_version?: number
          publish_complexity_factor?: number
          series_id?: string | null
          series_order?: number | null
          language?: string
          tags?: string[]
          metadata?: Json | null
        }
        Update: {
          title?: string
          subtitle?: string | null
          description?: string | null
          cover_url?: string | null
          back_cover_url?: string | null
          cover_spread_url?: string | null
          cover_crop?: Json | null
          pages?: Json[] | null
          preview_pages?: number[] | null
          price?: number
          status?: 'draft' | 'published'
          review_status?: 'pending' | 'approved' | 'rejected'
          content_version?: number
          publish_complexity_factor?: number
          series_id?: string | null
          series_order?: number | null
          language?: string
          tags?: string[]
          metadata?: Json | null
        }
      }
      book_editors: {
        Row: {
          id: string
          book_id: string
          user_id: string
          can_publish: boolean
          created_at: string
        }
        Insert: {
          book_id: string
          user_id: string
          can_publish?: boolean
        }
        Update: {
          can_publish?: boolean
        }
      }
      book_revenue_shares: {
        Row: {
          id: string
          book_id: string
          user_id: string
          share_percent: number
          created_at: string
        }
        Insert: {
          book_id: string
          user_id: string
          share_percent: number
        }
        Update: {
          share_percent?: number
        }
      }
      book_series: {
        Row: {
          id: string
          title: string
          description: string | null
          publisher_id: string
          created_at: string
        }
        Insert: {
          title: string
          description?: string | null
          publisher_id: string
        }
        Update: {
          title?: string
          description?: string | null
        }
      }
      book_comments: {
        Row: {
          id: string
          book_id: string
          user_id: string
          parent_id: string | null
          content: string
          is_hidden: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          book_id: string
          user_id: string
          parent_id?: string | null
          content: string
          is_hidden?: boolean
        }
        Update: {
          content?: string
          is_hidden?: boolean
        }
      }
      book_reviews: {
        Row: {
          id: string
          book_id: string
          user_id: string
          rating: number
          created_at: string
        }
        Insert: {
          book_id: string
          user_id: string
          rating: number
        }
        Update: {
          rating?: number
        }
      }
      book_reading_sessions: {
        Row: {
          id: string
          book_id: string
          user_id: string
          device_id: string
          expires_at: string
          created_at: string
        }
        Insert: {
          book_id: string
          user_id: string
          device_id: string
          expires_at?: string
        }
        Update: {}
      }
      highlights: {
        Row: {
          id: string
          user_id: string
          book_id: string
          page_index: number
          anchor: string
          color: string
          note: string | null
          created_at: string
        }
        Insert: {
          user_id: string
          book_id: string
          page_index: number
          anchor: string
          color: string
          note?: string | null
        }
        Update: {
          color?: string
          note?: string | null
        }
      }
      user_books: {
        Row: {
          id: string
          user_id: string
          book_id: string
          purchased_at: string
        }
        Insert: {
          user_id: string
          book_id: string
        }
        Update: {}
      }
      audio_editions: {
        Row: {
          id: string
          book_id: string
          title: string
          narrator: string | null
          cover_url: string | null
          price: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          book_id: string
          title: string
          narrator?: string | null
          cover_url?: string | null
          price?: number
          is_active?: boolean
        }
        Update: {
          title?: string
          narrator?: string | null
          cover_url?: string | null
          price?: number
          is_active?: boolean
        }
      }
      audio_chapters: {
        Row: {
          id: string
          edition_id: string
          title: string
          file_path: string
          duration: number
          chapter_number: number
          is_preview: boolean
          created_at: string
        }
        Insert: {
          edition_id: string
          title: string
          file_path: string
          duration?: number
          chapter_number: number
          is_preview?: boolean
        }
        Update: {
          title?: string
          file_path?: string
          duration?: number
          chapter_number?: number
          is_preview?: boolean
        }
      }
      user_audio_books: {
        Row: {
          id: string
          user_id: string
          edition_id: string
          purchased_at: string
        }
        Insert: {
          user_id: string
          edition_id: string
        }
        Update: {}
      }
      audio_progress: {
        Row: {
          id: string
          user_id: string
          edition_id: string
          chapter_id: string
          position: number
          updated_at: string
        }
        Insert: {
          user_id: string
          edition_id: string
          chapter_id: string
          position?: number
        }
        Update: {
          position?: number
        }
      }
      audio_bookmarks: {
        Row: {
          id: string
          user_id: string
          edition_id: string
          chapter_id: string
          position: number
          note: string | null
          created_at: string
        }
        Insert: {
          user_id: string
          edition_id: string
          chapter_id: string
          position: number
          note?: string | null
        }
        Update: {
          note?: string | null
        }
      }
      publisher_profiles: {
        Row: {
          id: string
          user_id: string
          slug: string
          theme: string | null
          bio: string | null
          is_trusted: boolean
          created_at: string
        }
        Insert: {
          user_id: string
          slug: string
          theme?: string | null
          bio?: string | null
          is_trusted?: boolean
        }
        Update: {
          slug?: string
          theme?: string | null
          bio?: string | null
          is_trusted?: boolean
        }
      }
      publisher_upgrade_requests: {
        Row: {
          id: string
          user_id: string
          status: 'pending' | 'approved' | 'rejected'
          created_at: string
        }
        Insert: {
          user_id: string
          status?: 'pending' | 'approved' | 'rejected'
        }
        Update: {
          status?: 'pending' | 'approved' | 'rejected'
        }
      }
      editor_access_requests: {
        Row: {
          id: string
          publisher_id: string
          email: string
          status: 'pending' | 'accepted' | 'declined'
          created_at: string
        }
        Insert: {
          publisher_id: string
          email: string
          status?: 'pending' | 'accepted' | 'declined'
        }
        Update: {
          status?: 'pending' | 'accepted' | 'declined'
        }
      }
      credit_transactions: {
        Row: {
          id: string
          user_id: string
          amount: number
          type: string
          description: string | null
          reference_id: string | null
          created_at: string
        }
        Insert: {
          user_id: string
          amount: number
          type: string
          description?: string | null
          reference_id?: string | null
        }
        Update: {}
      }
      credit_purchase_requests: {
        Row: {
          id: string
          user_id: string
          amount: number
          status: 'pending' | 'approved' | 'rejected'
          admin_id: string | null
          created_at: string
        }
        Insert: {
          user_id: string
          amount: number
          status?: 'pending' | 'approved' | 'rejected'
          admin_id?: string | null
        }
        Update: {
          status?: 'pending' | 'approved' | 'rejected'
          admin_id?: string | null
        }
      }
      payment_orders: {
        Row: {
          id: string
          user_id: string
          authority: string | null
          ref_id: string | null
          amount_toman: number
          credits: number
          status: 'pending' | 'completed' | 'failed'
          created_at: string
        }
        Insert: {
          user_id: string
          authority?: string | null
          ref_id?: string | null
          amount_toman: number
          credits: number
          status?: 'pending' | 'completed' | 'failed'
        }
        Update: {
          authority?: string | null
          ref_id?: string | null
          status?: 'pending' | 'completed' | 'failed'
        }
      }
      platform_fee_settings: {
        Row: {
          id: number
          platform_fee_percent: number
          min_platform_fee: number
          publish_fee: number
          ai_text_cost: number
          ai_image_cost: number
          publisher_signup_fee: number
          credits_per_toman: number
          updated_at: string
        }
        Insert: {}
        Update: {
          platform_fee_percent?: number
          min_platform_fee?: number
          publish_fee?: number
          ai_text_cost?: number
          ai_image_cost?: number
          publisher_signup_fee?: number
          credits_per_toman?: number
        }
      }
      ai_usage_log: {
        Row: {
          id: string
          user_id: string
          operation: string
          book_id: string | null
          model: string
          metadata: Json | null
          credits_cost: number
          usd_cost: number
          created_at: string
        }
        Insert: {
          user_id: string
          operation: string
          book_id?: string | null
          model: string
          metadata?: Json | null
          credits_cost: number
          usd_cost: number
        }
        Update: {}
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          body: string | null
          link: string | null
          metadata: Json | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          user_id: string
          type: string
          title: string
          body?: string | null
          link?: string | null
          metadata?: Json | null
          is_read?: boolean
        }
        Update: {
          is_read?: boolean
        }
      }
      sms_settings: {
        Row: {
          id: number
          provider: string
          api_key: string
          sender: string
          updated_at: string
        }
        Insert: {}
        Update: {
          provider?: string
          api_key?: string
          sender?: string
        }
      }
      sms_log: {
        Row: {
          id: string
          phone: string
          message: string
          status: string
          created_at: string
        }
        Insert: {
          phone: string
          message: string
          status: string
        }
        Update: {}
      }
      client_error_logs: {
        Row: {
          id: string
          user_id: string | null
          error: string
          stack: string | null
          url: string | null
          created_at: string
        }
        Insert: {
          user_id?: string | null
          error: string
          stack?: string | null
          url?: string | null
        }
        Update: {}
      }
      user_offline_devices: {
        Row: {
          id: string
          user_id: string
          device_id: string
          device_name: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          user_id: string
          device_id: string
          device_name?: string | null
          is_active?: boolean
        }
        Update: {
          is_active?: boolean
        }
      }
      word_imports: {
        Row: {
          id: string
          user_id: string
          book_id: string | null
          status: 'pending' | 'processing' | 'completed' | 'failed'
          error: string | null
          created_at: string
        }
        Insert: {
          user_id: string
          book_id?: string | null
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          error?: string | null
        }
        Update: {
          book_id?: string | null
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          error?: string | null
        }
      }
      comment_moderation_settings: {
        Row: {
          id: number
          block_links: boolean
          block_mentions: boolean
          sensitive_words: string[]
          auto_hide_threshold: number
          updated_at: string
        }
        Insert: {}
        Update: {
          block_links?: boolean
          block_mentions?: boolean
          sensitive_words?: string[]
          auto_hide_threshold?: number
        }
      }
    }
    Functions: {
      has_role: {
        Args: { uid: string; role: string }
        Returns: boolean
      }
      is_admin: {
        Args: { uid: string }
        Returns: boolean
      }
      is_super_admin: {
        Args: { uid: string }
        Returns: boolean
      }
      is_publisher: {
        Args: { uid: string }
        Returns: boolean
      }
      can_edit_book: {
        Args: { uid: string; book_id: string }
        Returns: boolean
      }
      get_book_content: {
        Args: { book_id: string }
        Returns: Json
      }
      get_book_preview_content: {
        Args: { book_id: string }
        Returns: Json
      }
      get_audio_chapters: {
        Args: { edition_id: string }
        Returns: Json
      }
      purchase_book: {
        Args: { book_id: string }
        Returns: Json
      }
      purchase_audio_edition: {
        Args: { edition_id: string }
        Returns: Json
      }
      publish_book_paid: {
        Args: { book_id: string; complexity: number }
        Returns: Json
      }
      charge_ai_usage: {
        Args: { operation: string; book_id: string; model: string; metadata?: Json }
        Returns: Json
      }
      set_book_revenue_shares: {
        Args: { book_id: string; shares: Json }
        Returns: void
      }
      update_book_pages_partial: {
        Args: { book_id: string; patches: Json[] }
        Returns: void
      }
      complete_payment_order: {
        Args: { authority: string; ref_id: string }
        Returns: void
      }
      fail_payment_order: {
        Args: { authority: string }
        Returns: void
      }
      publisher_book_sales_stats: {
        Args: { publisher_id: string }
        Returns: Json
      }
      normalize_iran_mobile: {
        Args: { phone: string }
        Returns: string
      }
      is_valid_iran_national_id: {
        Args: { id: string }
        Returns: boolean
      }
      admin_list_users: {
        Args: Record<string, never>
        Returns: Json
      }
      admin_recent_transactions: {
        Args: Record<string, never>
        Returns: Json
      }
      admin_adjust_credits: {
        Args: { user_id: string; amount: number; description: string }
        Returns: void
      }
      admin_set_role: {
        Args: { user_id: string; role: string }
        Returns: void
      }
      admin_get_fee_settings: {
        Args: Record<string, never>
        Returns: Json
      }
      admin_update_platform_fees: {
        Args: { fees: Json }
        Returns: void
      }
    }
  }
}
