/**
 * Gerado por `generate_typescript_types` do Supabase MCP.
 * Não editar à mão: regenerar sempre que o schema mudar.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
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
      comandas: {
        Row: {
          aberta_em: string;
          aberta_por: string | null;
          atualizado_em: string;
          cancelada_por: string | null;
          client_request_id: string | null;
          cliente_id: string | null;
          conta_pedida_em: string | null;
          empresa_id: string;
          fechada_em: string | null;
          id: string;
          mesa_id: string;
          motivo_cancelamento: string | null;
          numero: number;
          observacoes: string | null;
          pessoas: number | null;
          status: Database["public"]["Enums"]["status_comanda"];
          taxa_servico_percentual: number;
        };
        Insert: {
          aberta_em?: string;
          aberta_por?: string | null;
          atualizado_em?: string;
          cancelada_por?: string | null;
          client_request_id?: string | null;
          cliente_id?: string | null;
          conta_pedida_em?: string | null;
          empresa_id: string;
          fechada_em?: string | null;
          id?: string;
          mesa_id: string;
          motivo_cancelamento?: string | null;
          numero: number;
          observacoes?: string | null;
          pessoas?: number | null;
          status?: Database["public"]["Enums"]["status_comanda"];
          taxa_servico_percentual?: number;
        };
        Update: {
          aberta_em?: string;
          aberta_por?: string | null;
          atualizado_em?: string;
          cancelada_por?: string | null;
          client_request_id?: string | null;
          cliente_id?: string | null;
          conta_pedida_em?: string | null;
          empresa_id?: string;
          fechada_em?: string | null;
          id?: string;
          mesa_id?: string;
          motivo_cancelamento?: string | null;
          numero?: number;
          observacoes?: string | null;
          pessoas?: number | null;
          status?: Database["public"]["Enums"]["status_comanda"];
          taxa_servico_percentual?: number;
        };
        Relationships: [
          {
            foreignKeyName: "comandas_aberta_por_fkey";
            columns: ["aberta_por"];
            isOneToOne: false;
            referencedRelation: "membros_empresa";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comandas_cancelada_por_fkey";
            columns: ["cancelada_por"];
            isOneToOne: false;
            referencedRelation: "membros_empresa";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comandas_cliente_fk";
            columns: ["empresa_id", "cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "comandas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comandas_mesa_fk";
            columns: ["empresa_id", "mesa_id"];
            isOneToOne: false;
            referencedRelation: "mesas";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "comandas_mesa_fk";
            columns: ["empresa_id", "mesa_id"];
            isOneToOne: false;
            referencedRelation: "mesas_estado";
            referencedColumns: ["empresa_id", "id"];
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
      eventos_cozinha: {
        Row: {
          criado_em: string;
          empresa_id: string;
          id: number;
          pedido_id: string;
          tipo: string;
        };
        Insert: {
          criado_em?: string;
          empresa_id: string;
          id?: never;
          pedido_id: string;
          tipo: string;
        };
        Update: {
          criado_em?: string;
          empresa_id?: string;
          id?: never;
          pedido_id?: string;
          tipo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "eventos_cozinha_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
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
      historico_status_pedido: {
        Row: {
          criado_em: string;
          de: Database["public"]["Enums"]["status_operacional_pedido"] | null;
          empresa_id: string;
          id: number;
          membro_id: string | null;
          motivo: string | null;
          para: Database["public"]["Enums"]["status_operacional_pedido"];
          pedido_id: string;
        };
        Insert: {
          criado_em?: string;
          de?: Database["public"]["Enums"]["status_operacional_pedido"] | null;
          empresa_id: string;
          id?: never;
          membro_id?: string | null;
          motivo?: string | null;
          para: Database["public"]["Enums"]["status_operacional_pedido"];
          pedido_id: string;
        };
        Update: {
          criado_em?: string;
          de?: Database["public"]["Enums"]["status_operacional_pedido"] | null;
          empresa_id?: string;
          id?: never;
          membro_id?: string | null;
          motivo?: string | null;
          para?: Database["public"]["Enums"]["status_operacional_pedido"];
          pedido_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "historico_status_pedido_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "historico_status_pedido_membro_id_fkey";
            columns: ["membro_id"];
            isOneToOne: false;
            referencedRelation: "membros_empresa";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hsp_pedido_fk";
            columns: ["empresa_id", "pedido_id"];
            isOneToOne: false;
            referencedRelation: "pedidos";
            referencedColumns: ["empresa_id", "id"];
          },
        ];
      };
      item_pedido_adicional: {
        Row: {
          empresa_id: string;
          id: string;
          item_pedido_id: string;
          nome_grupo: string;
          nome_opcao: string;
          opcao_id: string;
          preco: number;
        };
        Insert: {
          empresa_id: string;
          id?: string;
          item_pedido_id: string;
          nome_grupo: string;
          nome_opcao: string;
          opcao_id: string;
          preco: number;
        };
        Update: {
          empresa_id?: string;
          id?: string;
          item_pedido_id?: string;
          nome_grupo?: string;
          nome_opcao?: string;
          opcao_id?: string;
          preco?: number;
        };
        Relationships: [
          {
            foreignKeyName: "ipa_item_fk";
            columns: ["empresa_id", "item_pedido_id"];
            isOneToOne: false;
            referencedRelation: "itens_pedido";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "ipa_opcao_fk";
            columns: ["empresa_id", "opcao_id"];
            isOneToOne: false;
            referencedRelation: "opcoes_adicionais";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "item_pedido_adicional_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      itens_pedido: {
        Row: {
          adicionais_total: number;
          criado_em: string;
          empresa_id: string;
          enviado_em: string | null;
          id: string;
          nome_produto: string;
          nome_setor: string | null;
          observacoes: string | null;
          pedido_id: string;
          preco_unitario: number;
          produto_id: string;
          quantidade: number;
          setor_id: string | null;
          total: number | null;
        };
        Insert: {
          adicionais_total?: number;
          criado_em?: string;
          empresa_id: string;
          enviado_em?: string | null;
          id?: string;
          nome_produto: string;
          nome_setor?: string | null;
          observacoes?: string | null;
          pedido_id: string;
          preco_unitario: number;
          produto_id: string;
          quantidade: number;
          setor_id?: string | null;
          total?: number | null;
        };
        Update: {
          adicionais_total?: number;
          criado_em?: string;
          empresa_id?: string;
          enviado_em?: string | null;
          id?: string;
          nome_produto?: string;
          nome_setor?: string | null;
          observacoes?: string | null;
          pedido_id?: string;
          preco_unitario?: number;
          produto_id?: string;
          quantidade?: number;
          setor_id?: string | null;
          total?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "itens_pedido_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "itens_pedido_fk";
            columns: ["empresa_id", "pedido_id"];
            isOneToOne: false;
            referencedRelation: "pedidos";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "itens_produto_fk";
            columns: ["empresa_id", "produto_id"];
            isOneToOne: false;
            referencedRelation: "produtos";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "itens_setor_fk";
            columns: ["empresa_id", "setor_id"];
            isOneToOne: false;
            referencedRelation: "setores_cozinha";
            referencedColumns: ["empresa_id", "id"];
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
      pedidos: {
        Row: {
          acrescimo: number;
          atualizado_em: string;
          cancelado_em: string | null;
          cancelado_por: string | null;
          client_request_id: string | null;
          cliente_id: string | null;
          comanda_id: string | null;
          confirmado_em: string | null;
          criado_em: string;
          criado_por: string | null;
          desconto: number;
          empresa_id: string;
          entregue_em: string | null;
          id: string;
          motivo_cancelamento: string | null;
          numero: number;
          observacoes: string | null;
          origem: Database["public"]["Enums"]["origem_pedido"];
          preparo_em: string | null;
          pronto_em: string | null;
          status_financeiro: Database["public"]["Enums"]["status_financeiro_pedido"];
          status_operacional: Database["public"]["Enums"]["status_operacional_pedido"];
          subtotal: number;
          total: number | null;
          valor_pago: number;
        };
        Insert: {
          acrescimo?: number;
          atualizado_em?: string;
          cancelado_em?: string | null;
          cancelado_por?: string | null;
          client_request_id?: string | null;
          cliente_id?: string | null;
          comanda_id?: string | null;
          confirmado_em?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          desconto?: number;
          empresa_id: string;
          entregue_em?: string | null;
          id?: string;
          motivo_cancelamento?: string | null;
          numero: number;
          observacoes?: string | null;
          origem: Database["public"]["Enums"]["origem_pedido"];
          preparo_em?: string | null;
          pronto_em?: string | null;
          status_financeiro?: Database["public"]["Enums"]["status_financeiro_pedido"];
          status_operacional?: Database["public"]["Enums"]["status_operacional_pedido"];
          subtotal?: number;
          total?: number | null;
          valor_pago?: number;
        };
        Update: {
          acrescimo?: number;
          atualizado_em?: string;
          cancelado_em?: string | null;
          cancelado_por?: string | null;
          client_request_id?: string | null;
          cliente_id?: string | null;
          comanda_id?: string | null;
          confirmado_em?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          desconto?: number;
          empresa_id?: string;
          entregue_em?: string | null;
          id?: string;
          motivo_cancelamento?: string | null;
          numero?: number;
          observacoes?: string | null;
          origem?: Database["public"]["Enums"]["origem_pedido"];
          preparo_em?: string | null;
          pronto_em?: string | null;
          status_financeiro?: Database["public"]["Enums"]["status_financeiro_pedido"];
          status_operacional?: Database["public"]["Enums"]["status_operacional_pedido"];
          subtotal?: number;
          total?: number | null;
          valor_pago?: number;
        };
        Relationships: [
          {
            foreignKeyName: "pedidos_cancelado_por_fkey";
            columns: ["cancelado_por"];
            isOneToOne: false;
            referencedRelation: "membros_empresa";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pedidos_cliente_fk";
            columns: ["empresa_id", "cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "pedidos_comanda_fk";
            columns: ["empresa_id", "comanda_id"];
            isOneToOne: false;
            referencedRelation: "comandas";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "pedidos_comanda_fk";
            columns: ["empresa_id", "comanda_id"];
            isOneToOne: false;
            referencedRelation: "comandas_resumo";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "pedidos_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "membros_empresa";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pedidos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
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
      comandas_resumo: {
        Row: {
          aberta_em: string | null;
          cliente_id: string | null;
          conta_pedida_em: string | null;
          empresa_id: string | null;
          fechada_em: string | null;
          id: string | null;
          mesa_id: string | null;
          motivo_cancelamento: string | null;
          nome_cliente: string | null;
          nome_mesa: string | null;
          numero: number | null;
          observacoes: string | null;
          pedidos: number | null;
          pedidos_em_producao: number | null;
          pessoas: number | null;
          status: Database["public"]["Enums"]["status_comanda"] | null;
          subtotal: number | null;
          taxa_servico: number | null;
          taxa_servico_percentual: number | null;
          total: number | null;
          valor_pago: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "comandas_cliente_fk";
            columns: ["empresa_id", "cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "comandas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comandas_mesa_fk";
            columns: ["empresa_id", "mesa_id"];
            isOneToOne: false;
            referencedRelation: "mesas";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "comandas_mesa_fk";
            columns: ["empresa_id", "mesa_id"];
            isOneToOne: false;
            referencedRelation: "mesas_estado";
            referencedColumns: ["empresa_id", "id"];
          },
        ];
      };
      mesas_estado: {
        Row: {
          aberta_em: string | null;
          ativa: boolean | null;
          comanda_id: string | null;
          comanda_numero: number | null;
          empresa_id: string | null;
          id: string | null;
          lugares: number | null;
          nome: string | null;
          ordem: number | null;
          pedidos_em_producao: number | null;
          pessoas: number | null;
          status: Database["public"]["Enums"]["status_mesa"] | null;
          subtotal: number | null;
          total: number | null;
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
    };
    Functions: {
      abrir_comanda: {
        Args: {
          p_client_request_id?: string;
          p_cliente?: string;
          p_empresa: string;
          p_mesa: string;
          p_observacoes?: string;
          p_pessoas?: number;
        };
        Returns: string;
      };
      aceitar_convite: { Args: { p_token: string }; Returns: string };
      adicionar_itens_pedido: {
        Args: { p_itens: Json; p_pedido: string };
        Returns: undefined;
      };
      ajustar_valores_pedido: {
        Args: { p_acrescimo: number; p_desconto: number; p_pedido: string };
        Returns: undefined;
      };
      alterar_item_pedido: {
        Args: { p_item: string; p_observacoes?: string; p_quantidade: number };
        Returns: undefined;
      };
      alterar_papel_membro: {
        Args: {
          p_membro: string;
          p_papel: Database["public"]["Enums"]["papel_usuario"];
        };
        Returns: undefined;
      };
      avancar_status_pedido: {
        Args: {
          p_para: Database["public"]["Enums"]["status_operacional_pedido"];
          p_pedido: string;
        };
        Returns: undefined;
      };
      cancelar_comanda: {
        Args: { p_comanda: string; p_motivo: string };
        Returns: undefined;
      };
      cancelar_convite: { Args: { p_convite: string }; Returns: undefined };
      cancelar_pedido: {
        Args: { p_motivo: string; p_pedido: string };
        Returns: undefined;
      };
      confirmar_pedido: { Args: { p_pedido: string }; Returns: undefined };
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
      criar_pedido: {
        Args: {
          p_acrescimo?: number;
          p_client_request_id?: string;
          p_comanda?: string;
          p_confirmar?: boolean;
          p_desconto?: number;
          p_empresa: string;
          p_itens: Json;
          p_observacoes?: string;
          p_origem: Database["public"]["Enums"]["origem_pedido"];
        };
        Returns: string;
      };
      definir_membro_ativo: {
        Args: { p_ativo: boolean; p_membro: string };
        Returns: undefined;
      };
      encerrar_comanda: { Args: { p_comanda: string }; Returns: undefined };
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
      painel_cozinha: {
        Args: { p_empresa: string };
        Returns: {
          adicionais: string[];
          comanda_numero: number;
          confirmado_em: string;
          criado_em: string;
          enviado_em: string;
          item_id: string;
          nome_mesa: string;
          nome_produto: string;
          nome_setor: string;
          numero: number;
          observacoes_item: string;
          observacoes_pedido: string;
          origem: Database["public"]["Enums"]["origem_pedido"];
          pedido_id: string;
          preparo_em: string;
          pronto_em: string;
          quantidade: number;
          status: Database["public"]["Enums"]["status_operacional_pedido"];
        }[];
      };
      pedir_conta: { Args: { p_comanda: string }; Returns: undefined };
      remover_item_pedido: { Args: { p_item: string }; Returns: undefined };
      renomear_membro: {
        Args: { p_membro: string; p_nome_exibicao: string };
        Returns: undefined;
      };
      transferir_comanda: {
        Args: { p_comanda: string; p_mesa_destino: string };
        Returns: undefined;
      };
    };
    Enums: {
      metodo_pagamento: "DINHEIRO" | "PIX" | "DEBITO" | "CREDITO";
      origem_pedido: "BALCAO" | "MESA";
      papel_usuario: "owner" | "admin" | "cashier" | "waiter" | "kitchen";
      status_comanda: "OPEN" | "PAYMENT_PENDING" | "PAID" | "CLOSED" | "CANCELLED";
      status_convite: "PENDENTE" | "ACEITO" | "CANCELADO";
      status_financeiro_pedido: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "REFUNDED";
      status_mesa: "LIVRE" | "OCUPADA" | "AGUARDANDO_PAGAMENTO";
      status_operacional_pedido:
        "DRAFT" | "CONFIRMED" | "PREPARING" | "READY" | "DELIVERED" | "CANCELLED";
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
      origem_pedido: ["BALCAO", "MESA"],
      papel_usuario: ["owner", "admin", "cashier", "waiter", "kitchen"],
      status_comanda: ["OPEN", "PAYMENT_PENDING", "PAID", "CLOSED", "CANCELLED"],
      status_convite: ["PENDENTE", "ACEITO", "CANCELADO"],
      status_financeiro_pedido: ["UNPAID", "PARTIALLY_PAID", "PAID", "REFUNDED"],
      status_mesa: ["LIVRE", "OCUPADA", "AGUARDANDO_PAGAMENTO"],
      status_operacional_pedido: [
        "DRAFT",
        "CONFIRMED",
        "PREPARING",
        "READY",
        "DELIVERED",
        "CANCELLED",
      ],
      tipo_sequencia: ["PEDIDO", "COMANDA"],
    },
  },
} as const;
