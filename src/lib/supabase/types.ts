export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ReplyStatus = "pending" | "draft" | "published";

export interface Database {
  public: {
    Tables: {
      brands: {
        Row: {
          id: string;
          name: string;
          tone_manual: string | null;
          sample_replies: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          tone_manual?: string | null;
          sample_replies?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          tone_manual?: string | null;
          sample_replies?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      locations: {
        Row: {
          id: string;
          brand_id: string;
          google_location_id: string;
          name: string;
          address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          google_location_id: string;
          name: string;
          address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          google_location_id?: string;
          name?: string;
          address?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "locations_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          id: string;
          location_id: string;
          google_review_id: string;
          reviewer_name: string | null;
          rating: number;
          comment: string | null;
          review_created_at: string;
          reply_text: string | null;
          reply_status: ReplyStatus;
          replied_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          location_id: string;
          google_review_id: string;
          reviewer_name?: string | null;
          rating: number;
          comment?: string | null;
          review_created_at: string;
          reply_text?: string | null;
          reply_status?: ReplyStatus;
          replied_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          location_id?: string;
          google_review_id?: string;
          reviewer_name?: string | null;
          rating?: number;
          comment?: string | null;
          review_created_at?: string;
          reply_text?: string | null;
          reply_status?: ReplyStatus;
          replied_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      generated_drafts: {
        Row: {
          id: string;
          review_id: string;
          draft_text: string;
          model_used: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          review_id: string;
          draft_text: string;
          model_used: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          review_id?: string;
          draft_text?: string;
          model_used?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "generated_drafts_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: false;
            referencedRelation: "reviews";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      reply_status: ReplyStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type BrandsRow = Database["public"]["Tables"]["brands"]["Row"];
export type BrandsInsert = Database["public"]["Tables"]["brands"]["Insert"];

export type LocationsRow = Database["public"]["Tables"]["locations"]["Row"];
export type LocationsInsert = Database["public"]["Tables"]["locations"]["Insert"];

export type ReviewsRow = Database["public"]["Tables"]["reviews"]["Row"];
export type ReviewsInsert = Database["public"]["Tables"]["reviews"]["Insert"];

export type GeneratedDraftsRow =
  Database["public"]["Tables"]["generated_drafts"]["Row"];
export type GeneratedDraftsInsert =
  Database["public"]["Tables"]["generated_drafts"]["Insert"];
