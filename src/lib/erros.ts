/**
 * Contrato de erro do ARVON FOOD.
 *
 * O banco levanta as violações de regra de negócio com o código `P0001` e uma
 * mensagem já escrita para o usuário final. Qualquer outro erro é tratado como
 * falha técnica: fica no console e o usuário recebe um texto genérico, para que
 * nunca se exponha estrutura interna do banco.
 */
const MENSAGEM_PADRAO = "Não foi possível concluir a operação. Tente novamente.";

const CODIGO_REGRA_NEGOCIO = "P0001";

const MENSAGENS_AUTH: Record<string, string> = {
  invalid_credentials: "E-mail ou senha incorretos.",
  email_not_confirmed: "Confirme o seu e-mail antes de entrar.",
  email_exists: "Já existe uma conta com este e-mail.",
  user_already_exists: "Já existe uma conta com este e-mail.",
  weak_password: "Escolha uma senha mais forte, com pelo menos 8 caracteres.",
  same_password: "A nova senha precisa ser diferente da atual.",
  over_request_rate_limit: "Muitas tentativas em sequência. Aguarde um instante.",
  over_email_send_rate_limit: "Muitos e-mails enviados. Aguarde alguns minutos.",
  validation_failed: "Confira os dados informados.",
  signup_disabled: "O cadastro está desativado no momento.",
};

/**
 * Escritas diretas em tabela (catálogo, clientes, configurações) chegam como
 * código do Postgres. Traduzimos só o que dá para dizer sem revelar o nome da
 * constraint ou da tabela que falhou.
 */
const MENSAGENS_POSTGRES: Record<string, string> = {
  "23505": "Já existe um registro com esses dados.",
  "23503": "Este registro está em uso e não pode ser alterado ou removido.",
  "23514": "Confira os dados informados.",
  "23502": "Preencha todos os campos obrigatórios.",
  "22001": "Um dos campos ficou longo demais.",
  "42501": "Você não tem permissão para esta ação.",
};

function dadosDoErro(erro: unknown) {
  if (typeof erro !== "object" || erro === null) return null;

  const { code, message } = erro as { code?: unknown; message?: unknown };

  return {
    codigo: typeof code === "string" ? code : null,
    mensagem: typeof message === "string" ? message : null,
  };
}

/**
 * `porCodigo` deixa a tela trocar a tradução genérica por uma frase específica
 * do contexto — por exemplo, dizer "mesa" em vez de "registro" num 23505. Vale
 * só para os códigos declarados: qualquer outra falha segue o caminho genérico.
 */
export function mensagemDeErro(erro: unknown, porCodigo: Record<string, string> = {}): string {
  const dados = dadosDoErro(erro);

  if (dados?.codigo && dados.codigo in MENSAGENS_AUTH) {
    return MENSAGENS_AUTH[dados.codigo] ?? MENSAGEM_PADRAO;
  }

  if (dados?.codigo === CODIGO_REGRA_NEGOCIO && dados.mensagem) {
    return dados.mensagem;
  }

  console.error(erro);

  if (dados?.codigo && dados.codigo in porCodigo) {
    return porCodigo[dados.codigo] ?? MENSAGEM_PADRAO;
  }

  if (dados?.codigo && dados.codigo in MENSAGENS_POSTGRES) {
    return MENSAGENS_POSTGRES[dados.codigo] ?? MENSAGEM_PADRAO;
  }

  return MENSAGEM_PADRAO;
}

/** Erro com texto já pronto para o usuário, exibido como está por `mensagemDeErro`. */
export class ErroDeRegra extends Error {
  readonly code = CODIGO_REGRA_NEGOCIO;
}

/**
 * A RLS não acusa erro em UPDATE/DELETE bloqueado: a operação só não afeta
 * nenhuma linha. Pedir as linhas de volta (`.select("id")`) e exigir pelo
 * menos uma evita mostrar "salvo" quando nada mudou.
 */
export async function exigirAlteracao(
  consulta: PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<void> {
  const { data, error } = await consulta;
  if (error) throw error;
  if (!data?.length) {
    throw new ErroDeRegra(
      "Você não tem permissão para esta alteração ou o registro não existe mais.",
    );
  }
}

/** Códigos do Postgres usados nas mensagens específicas de cada tela. */
export const ERRO = {
  duplicado: "23505",
  emUso: "23503",
  invalido: "23514",
} as const;
