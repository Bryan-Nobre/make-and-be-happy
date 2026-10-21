import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  guardarConvitePendente,
  limparConvitePendente,
  lerConvitePendente,
  urlRedirectConvite,
} from "@/lib/convite-pendente";
import { mensagemDeErro } from "@/lib/erros";
import { useAuth } from "@/providers/auth";
import { cadastrar, sair } from "@/services/auth";

export const Route = createFileRoute("/cadastro")({
  validateSearch: (search: Record<string, unknown>): { convite?: string } => {
    const convite = search["convite"];
    return typeof convite === "string" && convite !== "" ? { convite } : {};
  },
  head: () => ({
    meta: [
      { title: "Criar conta — Arvon Food" },
      { name: "description", content: "Crie a sua conta para gerenciar o seu restaurante." },
    ],
  }),
  component: Cadastro,
});

const esquema = z
  .object({
    email: z.string().min(1, "Informe o seu e-mail.").email("Informe um e-mail válido."),
    senha: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
    confirmacao: z.string().min(1, "Repita a senha."),
  })
  .refine((valores) => valores.senha === valores.confirmacao, {
    path: ["confirmacao"],
    message: "As senhas não são iguais.",
  });

type Formulario = z.infer<typeof esquema>;

function Cadastro() {
  const { convite } = Route.useSearch();
  const navigate = useNavigate();
  const { usuario, carregando } = useAuth();
  const [aguardandoConfirmacao, setAguardandoConfirmacao] = useState(false);

  const form = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: { email: "", senha: "", confirmacao: "" },
  });

  const tokenConvite = convite || lerConvitePendente();

  useEffect(() => {
    if (convite) guardarConvitePendente(convite);
  }, [convite]);

  useEffect(() => {
    // Cadastro aberto só para aceitar convite de equipe — não para criar restaurante.
    if (aguardandoConfirmacao) return;
    if (tokenConvite) return;
    void navigate({ to: "/login", replace: true });
  }, [tokenConvite, navigate, aguardandoConfirmacao]);

  useEffect(() => {
    // Enquanto espera o e-mail, não redireciona sozinho: a outra aba do
    // confirmação compartilha a sessão e isso deixava a tela “travada”.
    if (aguardandoConfirmacao) return;
    if (carregando || !usuario) return;

    const token = convite || lerConvitePendente();
    if (token) {
      void navigate({ to: "/aceitar-convite", search: { convite: token }, replace: true });
      return;
    }

    void navigate({ to: "/login", replace: true });
  }, [carregando, usuario, convite, navigate, aguardandoConfirmacao]);

  const enviar = form.handleSubmit(async (valores) => {
    try {
      const token = convite || lerConvitePendente();
      if (!token) {
        toast.error("Cadastro disponível apenas com um convite de equipe.");
        return;
      }
      guardarConvitePendente(token);

      const comSessao = await cadastrar(valores.email, valores.senha, {
        emailRedirectTo: urlRedirectConvite(token),
      });
      if (!comSessao) setAguardandoConfirmacao(true);
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    }
  });

  if (!tokenConvite && !aguardandoConfirmacao) {
    return (
      <AuthShell
        titulo="Cadastro restrito"
        descricao="Contas de restaurante são criadas pela Arvon Food. Cadastro público existe só para quem recebeu convite de equipe."
        rodape={
          <>
            Já tem conta?{" "}
            <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
              Entrar
            </Link>
          </>
        }
      >
        <Button asChild className="h-11 w-full">
          <Link to="/login">Ir para o login</Link>
        </Button>
      </AuthShell>
    );
  }

  if (aguardandoConfirmacao) {
    const tokenPendente = convite || lerConvitePendente();
    return (
      <AuthShell
        titulo="Confirme o seu e-mail"
        descricao="Abra o link do e-mail nesta mesma tela ou na aba que abrir. Depois use Continuar para aceitar o convite."
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-primary-soft">
            <MailCheck className="size-5 text-primary" aria-hidden="true" />
          </span>
          {usuario && tokenPendente && (
            <Button
              className="h-11 w-full"
              onClick={() =>
                void navigate({
                  to: "/aceitar-convite",
                  search: { convite: tokenPendente },
                  replace: true,
                })
              }
            >
              Continuar para o convite
            </Button>
          )}
          <Button asChild variant="outline" className="h-11 w-full">
            <Link to="/login" search={{ convite: tokenPendente || undefined }}>
              Ir para o login
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full"
            onClick={() => {
              void sair()
                .then(() => {
                  limparConvitePendente();
                  setAguardandoConfirmacao(false);
                  toast.success("Sessão encerrada. Pode cadastrar outra conta.");
                })
                .catch((erro) => toast.error(mensagemDeErro(erro)));
            }}
          >
            Sair e usar outra conta
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      titulo="Criar conta"
      descricao="Crie a sua conta para aceitar o convite da equipe."
      rodape={
        <>
          Já tem conta?{" "}
          <Link
            to="/login"
            search={{ convite }}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Entrar
          </Link>
        </>
      }
    >
      <Form {...form}>
        <form onSubmit={enviar} className="space-y-4" noValidate>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-mail</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="voce@restaurante.com.br"
                    className="h-11"
                    {...field}
                  />
                </FormControl>
                {convite && (
                  <FormDescription>
                    Use o mesmo e-mail em que você recebeu o convite.
                  </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="senha"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Senha</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" className="h-11" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmacao"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Repetir senha</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" className="h-11" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="h-11 w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Criando…" : "Criar conta"}
          </Button>
        </form>
      </Form>
    </AuthShell>
  );
}
