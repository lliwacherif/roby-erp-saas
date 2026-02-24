export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string
          full_name: string | null
          is_root: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          full_name?: string | null
          is_root?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          full_name?: string | null
          is_root?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          logo_url?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenant_members: {
        Row: {
          tenant_id: string
          user_id: string
          role: 'admin' | 'user'
          created_at: string
        }
        Insert: {
          tenant_id: string
          user_id: string
          role?: 'admin' | 'user'
          created_at?: string
        }
        Update: {
          tenant_id?: string
          user_id?: string
          role?: 'admin' | 'user'
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          }
        ]
      }
      user_tenant_settings: {
        Row: {
          user_id: string
          current_tenant_id: string | null
          updated_at: string
        }
        Insert: {
          user_id: string
          current_tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          user_id?: string
          current_tenant_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tenant_company_profiles: {
        Row: {
          tenant_id: string
          company_name: string | null
          company_address: string | null
          company_phone: string | null
          company_email: string | null
          company_tax_id: string | null
          updated_at: string
        }
        Insert: {
          tenant_id: string
          company_name?: string | null
          company_address?: string | null
          company_phone?: string | null
          company_email?: string | null
          company_tax_id?: string | null
          updated_at?: string
        }
        Update: {
          tenant_id?: string
          company_name?: string | null
          company_address?: string | null
          company_phone?: string | null
          company_email?: string | null
          company_tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_company_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          }
        ]
      },
      fournisseurs: {
        Row: {
          id: string
          tenant_id: string
          nom: string
          contact: string | null
          immatricule_fiscale: string | null
          telephone: string | null
          email: string | null
          adresse: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          nom: string
          contact?: string | null
          immatricule_fiscale?: string | null
          telephone?: string | null
          email?: string | null
          adresse?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          nom?: string
          contact?: string | null
          immatricule_fiscale?: string | null
          telephone?: string | null
          email?: string | null
          adresse?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      },
      famille_articles: {
        Row: {
          id: string
          tenant_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          name?: string
          created_at?: string
        }
        Relationships: []
      }
      article_categories: {
        Row: {
          id: string
          tenant_id: string
          famille_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          famille_id: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          famille_id?: string
          name?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_categories_famille_id_fkey"
            columns: ["famille_id"]
            isOneToOne: false
            referencedRelation: "famille_articles"
            referencedColumns: ["id"]
          }
        ]
      }
      articles: {
        Row: {
          id: string
          tenant_id: string
          famille_id: string
          category_id: string
          fournisseur_id: string | null
          nom: string
          photo_url: string | null
          couleur: string | null
          prix_achat: number
          prix_vente_detail: number
          prix_vente_gros: number
          prix_location_min: number
          prix_location_max: number
          qte_on_hand: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          famille_id: string
          category_id: string
          fournisseur_id?: string | null
          nom: string
          photo_url?: string | null
          couleur?: string | null
          prix_achat?: number
          prix_vente_detail?: number
          prix_vente_gros?: number
          prix_location_min?: number
          prix_location_max?: number
          qte_on_hand?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          famille_id?: string
          category_id?: string
          fournisseur_id?: string | null
          nom?: string
          photo_url?: string | null
          couleur?: string | null
          prix_achat?: number
          prix_vente_detail?: number
          prix_vente_gros?: number
          prix_location_min?: number
          prix_location_max?: number
          qte_on_hand?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "articles_famille_id_fkey"
            columns: ["famille_id"]
            isOneToOne: false
            referencedRelation: "famille_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "article_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          }
        ]
      }
      stock_movements: {
        Row: {
          id: string
          tenant_id: string
          article_id: string
          qty_delta: number
          reason: string
          ref_table: string | null
          ref_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          article_id: string
          qty_delta: number
          reason: string
          ref_table?: string | null
          ref_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          article_id?: string
          qty_delta?: number
          reason?: string
          ref_table?: string | null
          ref_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          id: string
          tenant_id: string
          full_name: string
          phone: string | null
          email: string | null
          cin: string | null
          age: number | null
          address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          full_name: string
          phone?: string | null
          email?: string | null
          cin?: string | null
          age?: number | null
          address?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          full_name?: string
          phone?: string | null
          email?: string | null
          cin?: string | null
          age?: number | null
          address?: string | null
          created_at?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          id: string
          tenant_id: string
          client_id: string
          type: 'location' | 'vente'
          status: 'draft' | 'reservee' | 'confirmed' | 'returned' | 'cancelled'
          rental_start: string | null
          rental_end: string | null
          rental_deposit: number | null
          discount_amount: number
          total: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          client_id: string
          type: 'location' | 'vente'
          status?: 'draft' | 'reservee' | 'confirmed' | 'returned' | 'cancelled'
          rental_start?: string | null
          rental_end?: string | null
          rental_deposit?: number | null
          discount_amount?: number
          total?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          client_id?: string
          type?: 'location' | 'vente'
          status?: 'draft' | 'reservee' | 'confirmed' | 'returned' | 'cancelled'
          rental_start?: string | null
          rental_end?: string | null
          rental_deposit?: number | null
          discount_amount?: number
          total?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          }
        ]
      }
      service_items: {
        Row: {
          id: string
          tenant_id: string
          service_id: string
          article_id: string
          qty: number
          unit_price: number
          rental_deposit: number | null
          rental_start: string | null
          rental_end: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          service_id: string
          article_id: string
          qty: number
          unit_price: number
          rental_deposit?: number | null
          rental_start?: string | null
          rental_end?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          service_id?: string
          article_id?: string
          qty?: number
          unit_price?: number
          rental_deposit?: number | null
          rental_start?: string | null
          rental_end?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          }
        ]
      }
      depenses: {
        Row: {
          id: string
          tenant_id: string
          type: 'depense_interne' | 'voyage' | 'retouche_article' | 'equipment' | 'utilities' | 'marketing' | 'maintenance' | 'software' | 'insurance' | 'taxes' | 'office_supplies' | 'other'
          amount: number
          article_id: string | null
          spent_at: string
          label: string | null
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          type: 'depense_interne' | 'voyage' | 'retouche_article' | 'equipment' | 'utilities' | 'marketing' | 'maintenance' | 'software' | 'insurance' | 'taxes' | 'office_supplies' | 'other'
          amount: number
          article_id?: string | null
          spent_at?: string
          label?: string | null
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          type?: 'depense_interne' | 'voyage' | 'retouche_article' | 'equipment' | 'utilities' | 'marketing' | 'maintenance' | 'software' | 'insurance' | 'taxes' | 'office_supplies' | 'other'
          amount?: number
          article_id?: string | null
          spent_at?: string
          label?: string | null
          description?: string | null
          created_at?: string
        }
        Relationships: []
      }
      ouvriers: {
        Row: {
          id: string
          tenant_id: string
          name: string
          cin: string
          phone: string | null
          salaire_base: number
          joined_at: string | null
          pay_day: number | null
          // Personal
          date_of_birth: string | null
          address: string | null
          marital_status: string | null
          children_count: number | null
          // Professional
          employee_id: string | null
          job_title: string | null
          department: string | null
          contract_type: string | null
          hiring_date: string | null
          manager_name: string | null
          work_location: string | null
          // Salary
          payment_method: string | null
          bank_name: string | null
          rib: string | null
          // Admin
          employment_status: string | null
          contract_end_date: string | null
          work_schedule: string | null
          leave_balance: number | null
          // Security
          cnss_number: string | null
          emergency_contact: string | null
          internal_notes: string | null
          // Timestamps
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          name: string
          cin: string
          phone?: string | null
          salaire_base: number
          joined_at?: string | null
          pay_day?: number | null
          date_of_birth?: string | null
          address?: string | null
          marital_status?: string | null
          children_count?: number | null
          employee_id?: string | null
          job_title?: string | null
          department?: string | null
          contract_type?: string | null
          hiring_date?: string | null
          manager_name?: string | null
          work_location?: string | null
          payment_method?: string | null
          bank_name?: string | null
          rib?: string | null
          employment_status?: string | null
          contract_end_date?: string | null
          work_schedule?: string | null
          leave_balance?: number | null
          cnss_number?: string | null
          emergency_contact?: string | null
          internal_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          name?: string
          cin?: string
          phone?: string | null
          salaire_base?: number
          joined_at?: string | null
          pay_day?: number | null
          date_of_birth?: string | null
          address?: string | null
          marital_status?: string | null
          children_count?: number | null
          employee_id?: string | null
          job_title?: string | null
          department?: string | null
          contract_type?: string | null
          hiring_date?: string | null
          manager_name?: string | null
          work_location?: string | null
          payment_method?: string | null
          bank_name?: string | null
          rib?: string | null
          employment_status?: string | null
          contract_end_date?: string | null
          work_schedule?: string | null
          leave_balance?: number | null
          cnss_number?: string | null
          emergency_contact?: string | null
          internal_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      ouvrier_attendance: {
        Row: {
          id: string
          tenant_id: string
          ouvrier_id: string
          date: string
          status: 'Present' | 'Absent' | 'Leave' | 'Late'
          overtime_hours: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          ouvrier_id: string
          date: string
          status: 'Present' | 'Absent' | 'Leave' | 'Late'
          overtime_hours?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          ouvrier_id?: string
          date?: string
          status?: 'Present' | 'Absent' | 'Leave' | 'Late'
          overtime_hours?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ouvrier_attendance_ouvrier_id_fkey"
            columns: ["ouvrier_id"]
            isOneToOne: false
            referencedRelation: "ouvriers"
            referencedColumns: ["id"]
          }
        ]
      }
      salary_payments: {
        Row: {
          id: string
          tenant_id: string
          ouvrier_id: string
          amount: number
          period: string
          paid_at: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          ouvrier_id: string
          amount: number
          period: string
          paid_at?: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          ouvrier_id?: string
          amount?: number
          period?: string
          paid_at?: string
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_payments_ouvrier_id_fkey"
            columns: ["ouvrier_id"]
            isOneToOne: false
            referencedRelation: "ouvriers"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      v_stock_overview: {
        Row: {
          id: string
          tenant_id: string
          nom: string
          couleur: string | null
          category_name: string | null
          famille_name: string | null
          prix_achat: number
          prix_vente_detail: number
          prix_vente_gros: number
          qte_on_hand: number
        }
        Relationships: []
      }
    }
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
