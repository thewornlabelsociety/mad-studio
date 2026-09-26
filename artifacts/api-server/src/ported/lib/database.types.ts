export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_analytics: {
        Row: {
          campaign_id: string
          clicks: number | null
          conversions_count: number
          cpa: number | null
          cpc: number | null
          created_at: string
          ctr: number | null
          entity_id: string
          id: string
          impressions: number | null
          net_profit: number | null
          notes: string | null
          reporting_date: string
          revenue: number
          roas: number | null
          spend: number
          updated_at: string
        }
        Insert: {
          campaign_id: string
          clicks?: number | null
          conversions_count?: number
          cpa?: number | null
          cpc?: number | null
          created_at?: string
          ctr?: number | null
          entity_id: string
          id?: string
          impressions?: number | null
          net_profit?: number | null
          notes?: string | null
          reporting_date?: string
          revenue?: number
          roas?: number | null
          spend?: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          clicks?: number | null
          conversions_count?: number
          cpa?: number | null
          cpc?: number | null
          created_at?: string
          ctr?: number | null
          entity_id?: string
          id?: string
          impressions?: number | null
          net_profit?: number | null
          notes?: string | null
          reporting_date?: string
          revenue?: number
          roas?: number | null
          spend?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_analytics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_analytics_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_model_pricing: {
        Row: {
          active: boolean | null
          input_cost_per_million_usd: number
          model_id: string
          output_cost_per_million_usd: number
          provider: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          input_cost_per_million_usd: number
          model_id: string
          output_cost_per_million_usd: number
          provider: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          input_cost_per_million_usd?: number
          model_id?: string
          output_cost_per_million_usd?: number
          provider?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          ai_takeaway: string | null
          algorithmic_signals: Json | null
          asset_pack: Json | null
          created_at: string
          created_by: string | null
          entity_id: string
          id: string
          media_url: string | null
          outcome_rating: string | null
          published_at: string | null
          scheduled_for: string | null
          status: string | null
          studio_context: Json
          target_goal: string
          target_segment: string | null
          title: string
          updated_at: string
          what_didnt_work: string | null
          what_worked: string | null
        }
        Insert: {
          ai_takeaway?: string | null
          algorithmic_signals?: Json | null
          asset_pack?: Json | null
          created_at?: string
          created_by?: string | null
          entity_id: string
          id?: string
          media_url?: string | null
          outcome_rating?: string | null
          published_at?: string | null
          scheduled_for?: string | null
          status?: string | null
          studio_context?: Json
          target_goal: string
          target_segment?: string | null
          title: string
          updated_at?: string
          what_didnt_work?: string | null
          what_worked?: string | null
        }
        Update: {
          ai_takeaway?: string | null
          algorithmic_signals?: Json | null
          asset_pack?: Json | null
          created_at?: string
          created_by?: string | null
          entity_id?: string
          id?: string
          media_url?: string | null
          outcome_rating?: string | null
          published_at?: string | null
          scheduled_for?: string | null
          status?: string | null
          studio_context?: Json
          target_goal?: string
          target_segment?: string | null
          title?: string
          updated_at?: string
          what_didnt_work?: string | null
          what_worked?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entities: {
        Row: {
          audience_segments: Json
          brand_identity: Json
          business_model: string | null
          content_pillars: Json
          conversion_goals: Json
          created_at: string
          id: string
          industry: string
          local_context: Json
          name: string
          organization_id: string
          updated_at: string
          value_propositions: Json
          website_url: string | null
        }
        Insert: {
          audience_segments?: Json
          brand_identity?: Json
          business_model?: string | null
          content_pillars?: Json
          conversion_goals?: Json
          created_at?: string
          id?: string
          industry: string
          local_context?: Json
          name: string
          organization_id: string
          updated_at?: string
          value_propositions?: Json
          website_url?: string | null
        }
        Update: {
          audience_segments?: Json
          brand_identity?: Json
          business_model?: string | null
          content_pillars?: Json
          conversion_goals?: Json
          created_at?: string
          id?: string
          industry?: string
          local_context?: Json
          name?: string
          organization_id?: string
          updated_at?: string
          value_propositions?: Json
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_agent_metering: {
        Row: {
          agent_label: string
          agent_type: string
          completion_tokens: number
          created_at: string
          duration_ms: number
          entity_id: string
          id: string
          metadata: Json | null
          model_used: string
          prompt_tokens: number
          provider: string
          raw_cost_nzd: number
          raw_cost_usd: number
          summary: string | null
          total_tokens: number
        }
        Insert: {
          agent_label: string
          agent_type: string
          completion_tokens?: number
          created_at?: string
          duration_ms?: number
          entity_id: string
          id?: string
          metadata?: Json | null
          model_used: string
          prompt_tokens?: number
          provider?: string
          raw_cost_nzd?: number
          raw_cost_usd?: number
          summary?: string | null
          total_tokens?: number
        }
        Update: {
          agent_label?: string
          agent_type?: string
          completion_tokens?: number
          created_at?: string
          duration_ms?: number
          entity_id?: string
          id?: string
          metadata?: Json | null
          model_used?: string
          prompt_tokens?: number
          provider?: string
          raw_cost_nzd?: number
          raw_cost_usd?: number
          summary?: string | null
          total_tokens?: number
        }
        Relationships: [
          {
            foreignKeyName: "entity_agent_metering_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_access: {
        Row: {
          created_at: string
          entity_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_access_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_customer_quotes: {
        Row: {
          created_at: string
          customer_emotion: string | null
          entity_id: string
          id: string
          quote_text: string
          source: string | null
        }
        Insert: {
          created_at?: string
          customer_emotion?: string | null
          entity_id: string
          id?: string
          quote_text: string
          source?: string | null
        }
        Update: {
          created_at?: string
          customer_emotion?: string | null
          entity_id?: string
          id?: string
          quote_text?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_customer_quotes_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_documents: {
        Row: {
          created_at: string
          doc_type: string | null
          entity_id: string
          extracted_knowledge: string
          file_url: string
          id: string
          title: string
        }
        Insert: {
          created_at?: string
          doc_type?: string | null
          entity_id: string
          extracted_knowledge: string
          file_url: string
          id?: string
          title: string
        }
        Update: {
          created_at?: string
          doc_type?: string | null
          entity_id?: string
          extracted_knowledge?: string
          file_url?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_documents_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_channels: {
        Row: {
          account_name: string
          created_at: string
          credentials: Json | null
          entity_id: string
          id: string
          is_active: boolean | null
          platform: string
          webhook_url: string | null
        }
        Insert: {
          account_name: string
          created_at?: string
          credentials?: Json | null
          entity_id: string
          id?: string
          is_active?: boolean | null
          platform: string
          webhook_url?: string | null
        }
        Update: {
          account_name?: string
          created_at?: string
          credentials?: Json | null
          entity_id?: string
          id?: string
          is_active?: boolean | null
          platform?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_channels_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_media: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          entity_id: string
          file_name: string
          file_url: string
          id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          entity_id: string
          file_name: string
          file_url: string
          id?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string
          file_name?: string
          file_url?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_media_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string | null
          entity_id: string | null
          expires_at: string
          id: string
          organization_id: string
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email?: string | null
          entity_id?: string | null
          expires_at?: string
          id?: string
          organization_id?: string
          role: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string | null
          entity_id?: string | null
          expires_at?: string
          id?: string
          organization_id?: string
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_entities: {
        Row: {
          brand: string | null
          channels: string[]
          copy_draft: Json
          created_at: string
          description: string | null
          entity_id: string
          id: string
          images: string[]
          metrics: Json
          price: number | null
          published_at: string | null
          published_media_ids: Json
          scheduled_at: string | null
          status: string
          title: string
          trackable_slug: string | null
          updated_at: string
          website_item_id: string
        }
        Insert: {
          brand?: string | null
          channels?: string[]
          copy_draft?: Json
          created_at?: string
          description?: string | null
          entity_id: string
          id?: string
          images?: string[]
          metrics?: Json
          price?: number | null
          published_at?: string | null
          published_media_ids?: Json
          scheduled_at?: string | null
          status?: string
          title: string
          trackable_slug?: string | null
          updated_at?: string
          website_item_id: string
        }
        Update: {
          brand?: string | null
          channels?: string[]
          copy_draft?: Json
          created_at?: string
          description?: string | null
          entity_id?: string
          id?: string
          images?: string[]
          metrics?: Json
          price?: number | null
          published_at?: string | null
          published_media_ids?: Json
          scheduled_at?: string | null
          status?: string
          title?: string
          trackable_slug?: string | null
          updated_at?: string
          website_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_entities_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      link_clicks: {
        Row: {
          click_count: number
          created_at: string
          destination_url: string
          entity_id: string
          id: string
          marketing_entity_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          click_count?: number
          created_at?: string
          destination_url: string
          entity_id: string
          id?: string
          marketing_entity_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          click_count?: number
          created_at?: string
          destination_url?: string
          entity_id?: string
          id?: string
          marketing_entity_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "link_clicks_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_clicks_marketing_entity_id_fkey"
            columns: ["marketing_entity_id"]
            isOneToOne: false
            referencedRelation: "marketing_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_posts: {
        Row: {
          attempts: number
          campaign_id: string | null
          caption: string | null
          created_at: string | null
          created_by: string | null
          demographic_tag: string | null
          entity_id: string
          error_message: string | null
          id: string
          last_error: string | null
          marketing_entity_id: string | null
          media_url: string | null
          mode: string
          payload: Json | null
          platform: string
          published_at: string | null
          remote_media_id: string | null
          scheduled_time: string
          status: string
          timing_source: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          campaign_id?: string | null
          caption?: string | null
          created_at?: string | null
          created_by?: string | null
          demographic_tag?: string | null
          entity_id: string
          error_message?: string | null
          id?: string
          last_error?: string | null
          marketing_entity_id?: string | null
          media_url?: string | null
          mode?: string
          payload?: Json | null
          platform: string
          published_at?: string | null
          remote_media_id?: string | null
          scheduled_time: string
          status?: string
          timing_source?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          campaign_id?: string | null
          caption?: string | null
          created_at?: string | null
          created_by?: string | null
          demographic_tag?: string | null
          entity_id?: string
          error_message?: string | null
          id?: string
          last_error?: string | null
          marketing_entity_id?: string | null
          media_url?: string | null
          mode?: string
          payload?: Json | null
          platform?: string
          published_at?: string | null
          remote_media_id?: string | null
          scheduled_time?: string
          status?: string
          timing_source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_posts_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_posts_marketing_entity_id_fkey"
            columns: ["marketing_entity_id"]
            isOneToOne: false
            referencedRelation: "marketing_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_posts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      social_connections: {
        Row: {
          access_token: string
          account_id: string
          account_name: string
          created_at: string
          entity_id: string
          id: string
          is_active: boolean
          platform: string
          updated_at: string
        }
        Insert: {
          access_token: string
          account_id: string
          account_name?: string
          created_at?: string
          entity_id: string
          id?: string
          is_active?: boolean
          platform: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          account_id?: string
          account_name?: string
          created_at?: string
          entity_id?: string
          id?: string
          is_active?: boolean
          platform?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_connections_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          custom_domain: string | null
          id: string
          logo_url: string | null
          name: string
          primary_color: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_domain?: string | null
          id?: string
          logo_url?: string | null
          name: string
          primary_color?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_domain?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: Json }
      claim_first_org_admin: { Args: { p_org_id?: string | null }; Returns: string }
      has_entity_access: {
        Args: { allowed_roles: string[]; ent_id: string }
        Returns: boolean
      }
      is_org_admin: { Args: { org_id: string }; Returns: boolean }
      is_org_member: { Args: { org_id: string }; Returns: boolean }
      record_link_click: {
        Args: { p_slug: string }
        Returns: {
          destination_url: string
          entity_id: string
          marketing_entity_id: string
          click_count: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"]

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"]
