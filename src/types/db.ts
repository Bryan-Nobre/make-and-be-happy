/**
 * Gerado por `generate_typescript_types` do Supabase MCP.
 * Não editar à mão: regenerar sempre que o schema mudar.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      auditoria: {
        Row: {
          acao: string;
          criado_em: string;
          dados: Json | null;
          empresa_id: string;
          entidade: string;
          entidade_id: string | null;
          id: number;
          usuario_id: string | null;
        };
        Insert: {
          acao: string;
          criado_em?: string;
          dados?: Json | null;
          empresa_id: string;
          entidade: string;
          entidade_id?: string | null;
          id?: never;
          usuario_id?: string | null;
        };
        Update: {
          acao?: string;
          criado_em?: string;
          dados?: Json | null;
          empresa_id?: string;
          entidade?: string;
          entidade_id?: string | null;
          id?: never;
          usuario_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "auditoria_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      categorias: {
        Row: {
          ativa: boolean;
          atualizado_em: string;
          criado_em: string;
          empresa_id: string;
          id: string;
          nome: string;
          ordem: number;
        };
        Insert: {
          ativa?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          empresa_id: string;
          id?: string;
          nome: string;
          ordem?: number;
        };
        Update: {
          ativa?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          empresa_id?: string;
          id?: string;
          nome?: string;
          ordem?: number;
        };
        Relationships: [
          {
            foreignKeyName: "categorias_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      clientes: {
        Row: {
          ativo: boolean;
          atualizado_em: string;
          criado_em: string;
          email: string | null;
          empresa_id: string;
          id: string;
          nome: string;
          observacoes: string | null;
          telefone: string | null;
        };
        Insert: {
          ativo?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          email?: string | null;
          empresa_id: string;
          id?: string;
          nome: string;
          observacoes?: string | null;
          telefone?: string | null;
        };
        Update: {
          ativo?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          email?: string | null;
          empresa_id?: string;
          id?: string;
          nome?: string;
          observacoes?: string | null;
          telefone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "clientes_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      convites: {
        Row: {
          aceito_em: string | null;
          aceito_por: string | null;
          convidado_por: string | null;
          criado_em: string;
          email: string;
          empresa_id: string;
          expira_em: string;
          id: string;
          nome_exibicao: string;
          papel: Database["public"]["Enums"]["papel_usuario"];
          status: Database["public"]["Enums"]["status_convite"];
          token: string;
        };
        Insert: {
          aceito_em?: string | null;
          aceito_por?: string | null;
          convidado_por?: string | null;
          criado_em?: string;
          email: string;
          empresa_id: string;
          expira_em: string;
          id?: string;
          nome_exibicao: string;
          papel: Database["public"]["Enums"]["papel_usuario"];
          status?: Database["public"]["Enums"]["status_convite"];
          token: string;
        };
        Update: {
          aceito_em?: string | null;
          aceito_por?: string | null;
          convidado_por?: string | null;
          criado_em?: string;
          email?: string;
          empresa_id?: string;
          expira_em?: string;
          id?: string;
          nome_exibicao?: string;
          papel?: Database["public"]["Enums"]["papel_usuario"];
          status?: Database["public"]["Enums"]["status_convite"];
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "convites_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      empresas: {
        Row: {
          ativa: boolean;
          atualizado_em: string;
          cnpj: string | null;
          criado_em: string;
          endereco: string | null;
          envio_automatico_cozinha: boolean;
          horario_funcionamento: string | null;
          id: string;
          logo_url: string | null;
          nome: string;
          taxa_servico: number;
          telefone: string | null;
        };
        Insert: {
          ativa?: boolean;
          atualizado_em?: string;
          cnpj?: string | null;
          criado_em?: string;
          endereco?: string | null;
          envio_automatico_cozinha?: boolean;
          horario_funcionamento?: string | null;
          id?: string;
          logo_url?: string | null;
          nome: string;
          taxa_servico?: number;
          telefone?: string | null;
        };
        Update: {
          ativa?: boolean;
          atualizado_em?: string;
          cnpj?: string | null;
          criado_em?: string;
          endereco?: string | null;
          envio_automatico_cozinha?: boolean;
          horario_funcionamento?: string | null;
          id?: string;
          logo_url?: string | null;
          nome?: string;
          taxa_servico?: number;
          telefone?: string | null;
        };
        Relationships: [];
      };
      formas_pagamento: {
        Row: {
          ativa: boolean;
          atualizado_em: string;
          empresa_id: string;
          metodo: Database["public"]["Enums"]["metodo_pagamento"];
          ordem: number;
        };
        Insert: {
          ativa?: boolean;
          atualizado_em?: string;
          empresa_id: string;
          metodo: Database["public"]["Enums"]["metodo_pagamento"];
          ordem?: number;
        };
        Update: {
          ativa?: boolean;
          atualizado_em?: string;
          empresa_id?: string;
          metodo?: Database["public"]["Enums"]["metodo_pagamento"];
          ordem?: number;
        };
        Relationships: [
          {
            foreignKeyName: "formas_pagamento_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      grupos_adicionais: {
        Row: {
          ativo: boolean;
          atualizado_em: string;
          criado_em: string;
          empresa_id: string;
          id: string;
          maximo: number;
          minimo: number;
          nome: string;
          obrigatorio: boolean | null;
        };
        Insert: {
          ativo?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          empresa_id: string;
          id?: string;
          maximo?: number;
          minimo?: number;
          nome: string;
          obrigatorio?: boolean | null;
        };
        Update: {
          ativo?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          empresa_id?: string;
          id?: string;
          maximo?: number;
          minimo?: number;
          nome?: string;
          obrigatorio?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: "grupos_adicionais_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      membros_empresa: {
        Row: {
          ativo: boolean;
          atualizado_em: string;
          criado_em: string;
          empresa_id: string;
          id: string;
          nome_exibicao: string;
          papel: Database["public"]["Enums"]["papel_usuario"];
          usuario_id: string;
        };
        Insert: {
          ativo?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          empresa_id: string;
          id?: string;
          nome_exibicao: string;
          papel: Database["public"]["Enums"]["papel_usuario"];
          usuario_id: string;
        };
        Update: {
          ativo?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          empresa_id?: string;
          id?: string;
          nome_exibicao?: string;
          papel?: Database["public"]["Enums"]["papel_usuario"];
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "membros_empresa_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      mesas: {
        Row: {
          ativa: boolean;
          atualizado_em: string;
          criado_em: string;
          empresa_id: string;
          id: string;
          lugares: number;
          nome: string;
          ordem: number;
        };
        Insert: {
          ativa?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          empresa_id: string;
          id?: string;
          lugares?: number;
          nome: string;
          ordem?: number;
        };
        Update: {
          ativa?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          empresa_id?: string;
          id?: string;
          lugares?: number;
          nome?: string;
          ordem?: number;
        };
        Relationships: [
          {
            foreignKeyName: "mesas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      opcoes_adicionais: {
        Row: {
          ativo: boolean;
          atualizado_em: string;
          criado_em: string;
          empresa_id: string;
          grupo_id: string;
          id: string;
          nome: string;
          ordem: number;
          preco: number;
        };
        Insert: {
          ativo?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          empresa_id: string;
          grupo_id: string;
          id?: string;
          nome: string;
          ordem?: number;
          preco?: number;
        };
        Update: {
          ativo?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          empresa_id?: string;
          grupo_id?: string;
          id?: string;
          nome?: string;
          ordem?: number;
          preco?: number;
        };
        Relationships: [
          {
            foreignKeyName: "opcoes_adicionais_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "opcoes_grupo_fk";
            columns: ["empresa_id", "grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupos_adicionais";
            referencedColumns: ["empresa_id", "id"];
          },
        ];
      };
      produto_grupo_adicional: {
        Row: {
          empresa_id: string;
          grupo_id: string;
          ordem: number;
          produto_id: string;
        };
        Insert: {
          empresa_id: string;
          grupo_id: string;
          ordem?: number;
          produto_id: string;
        };
        Update: {
          empresa_id?: string;
          grupo_id?: string;
          ordem?: number;
          produto_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pga_grupo_fk";
            columns: ["empresa_id", "grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupos_adicionais";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "pga_produto_fk";
            columns: ["empresa_id", "produto_id"];
            isOneToOne: false;
            referencedRelation: "produtos";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "produto_grupo_adicional_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      produtos: {
        Row: {
          ativo: boolean;
          atualizado_em: string;
          categoria_id: string;
          codigo: string | null;
          criado_em: string;
          descricao: string | null;
          disponivel: boolean;
          empresa_id: string;
          id: string;
          imagem_url: string | null;
          nome: string;
          preco: number;
          setor_id: string | null;
        };
        Insert: {
          ativo?: boolean;
          atualizado_em?: string;
          categoria_id: string;
          codigo?: string | null;
          criado_em?: string;
          descricao?: string | null;
          disponivel?: boolean;
          empresa_id: string;
          id?: string;
          imagem_url?: string | null;
          nome: string;
          preco: number;
          setor_id?: string | null;
        };
        Update: {
          ativo?: boolean;
          atualizado_em?: string;
          categoria_id?: string;
          codigo?: string | null;
          criado_em?: string;
          descricao?: string | null;
          disponivel?: boolean;
          empresa_id?: string;
          id?: string;
          imagem_url?: string | null;
          nome?: string;
          preco?: number;
          setor_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "produtos_categoria_fk";
            columns: ["empresa_id", "categoria_id"];
            isOneToOne: false;
            referencedRelation: "categorias";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "produtos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "produtos_setor_fk";
            columns: ["empresa_id", "setor_id"];
            isOneToOne: false;
            referencedRelation: "setores_cozinha";
            referencedColumns: ["empresa_id", "id"];
          },
        ];
      };
      sequencias_empresa: {
        Row: {
          empresa_id: string;
          tipo: Database["public"]["Enums"]["tipo_sequencia"];
          valor: number;
        };
        Insert: {
          empresa_id: string;
          tipo: Database["public"]["Enums"]["tipo_sequencia"];
          valor?: number;
        };
        Update: {
          empresa_id?: string;
          tipo?: Database["public"]["Enums"]["tipo_sequencia"];
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "sequencias_empresa_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      setores_cozinha: {
        Row: {
          ativo: boolean;
          atualizado_em: string;
          criado_em: string;
          empresa_id: string;
          id: string;
          nome: string;
          ordem: number;
        };
        Insert: {
          ativo?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          empresa_id: string;
          id?: string;
          nome: string;
          ordem?: number;
        };
        Update: {
          ativo?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          empresa_id?: string;
          id?: string;
          nome?: string;
          ordem?: number;
        };
        Relationships: [
          {
            foreignKeyName: "setores_cozinha_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      aceitar_convite: { Args: { p_token: string }; Returns: string };
      alterar_papel_membro: {
        Args: {
          p_membro: string;
          p_papel: Database["public"]["Enums"]["papel_usuario"];
        };
        Returns: undefined;
      };
      cancelar_convite: { Args: { p_convite: string }; Returns: undefined };
      consultar_convite: {
        Args: { p_token: string };
        Returns: {
          email: string;
          empresa_nome: string;
          nome_exibicao: string;
          papel: Database["public"]["Enums"]["papel_usuario"];
          valido: boolean;
        }[];
      };
      convidar_membro: {
        Args: {
          p_email: string;
          p_empresa: string;
          p_nome_exibicao: string;
          p_papel: Database["public"]["Enums"]["papel_usuario"];
        };
        Returns: string;
      };
      criar_empresa_com_owner: {
        Args: {
          p_cnpj?: string;
          p_nome: string;
          p_nome_responsavel: string;
          p_telefone?: string;
        };
        Returns: string;
      };
      definir_membro_ativo: {
        Args: { p_ativo: boolean; p_membro: string };
        Returns: undefined;
      };
      listar_membros: {
        Args: { p_empresa: string };
        Returns: {
          ativo: boolean;
          criado_em: string;
          email: string;
          id: string;
          nome_exibicao: string;
          papel: Database["public"]["Enums"]["papel_usuario"];
          sou_eu: boolean;
          usuario_id: string;
        }[];
      };
      renomear_membro: {
        Args: { p_membro: string; p_nome_exibicao: string };
        Returns: undefined;
      };
    };
    Enums: {
      metodo_pagamento: "DINHEIRO" | "PIX" | "DEBITO" | "CREDITO";
      papel_usuario: "owner" | "admin" | "cashier" | "waiter" | "kitchen";
      status_convite: "PENDENTE" | "ACEITO" | "CANCELADO";
      tipo_sequencia: "PEDIDO" | "COMANDA";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      metodo_pagamento: ["DINHEIRO", "PIX", "DEBITO", "CREDITO"],
      papel_usuario: ["owner", "admin", "cashier", "waiter", "kitchen"],
      status_convite: ["PENDENTE", "ACEITO", "CANCELADO"],
      tipo_sequencia: ["PEDIDO", "COMANDA"],
    },
  },
} as const;
