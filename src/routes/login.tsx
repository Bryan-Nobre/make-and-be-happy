import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { mensagemDeErro } from "@/lib/erros";
import { useAuth } from "@/providers/auth";
import { entrar } from "@/services/auth";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { convite?: string } => {
    const convite = search["convite"];
    return typeof convite === "string" && convite !== "" ? { convite } : {};
  },
  head: () => ({
    meta: [
      { title: "Entrar — ARVON FOOD" },
      { name: "description", content: "Acesse o painel de gestão do seu restaurante." },
    ],
  }),
  component: Login,
});

const esquema = z.object({
  email: z.string().min(1, "Informe o seu e-mail.").email("Informe um e-mail válido."),
  senha: z.string().min(1, "Informe a sua senha."),
});

type Formulario = z.infer<typeof esquema>;

function Login() {
  const { convite } = Route.useSearch();
  const navigate = useNavigate();
  const { usuario, carregando } = useAuth();

  const form = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: { email: "", senha: "" },
  });

  useEffect(() => {
    if (carregando || !usuario) return;

    if (convite) {
      void navigate({ to: "/aceitar-convite", search: { token: convite }, replace: true });
      return;
    }

    void navigate({ to: "/", replace: true });
  }, [carregando, usuario, convite, navigate]);

  const enviar = form.handleSubmit(async (valores) => {
    try {
      await entrar(valores.email, valores.senha);
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    }
  });

  return (
    <AuthShell
      titulo="Entrar"
      descricao="Use o e-mail e a senha cadastrados para acessar a operação."
      rodape={
        <>
          Ainda não tem conta?{" "}
          <Link
            to="/cadastro"
            search={{ convite }}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Criar conta
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
                  <Input
                    type="password"
                    autoComplete="current-password"
                    className="h-11"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="h-11 w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </Form>
    </AuthShell>
  );
}
