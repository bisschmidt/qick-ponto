-- CreateEnum
CREATE TYPE "RegimeTrabalhista" AS ENUM ('CLT', 'APRENDIZ', 'ESTAGIO', 'PJ');

-- CreateEnum
CREATE TYPE "TipoJornada" AS ENUM ('PADRAO_CLT', 'CALL_CENTER_NR17', 'CALL_CENTER_COMP', 'JORNADA_12_36', 'JORNADA_24_48', 'PERSONALIZADA');

-- CreateEnum
CREATE TYPE "PerfilAcesso" AS ENUM ('ADMIN_TENANT', 'GESTOR', 'RH_DP', 'COLABORADOR', 'AUDITOR');

-- CreateEnum
CREATE TYPE "TipoMarcacao" AS ENUM ('ENTRADA', 'SAIDA_PAUSA_NR17', 'RETORNO_PAUSA_NR17', 'SAIDA_INTERVALO', 'RETORNO_INTERVALO', 'SAIDA_PAUSA_FISIOLOGICA', 'RETORNO_PAUSA_FISIOLOGICA', 'SAIDA_PAUSA_CRITICA', 'RETORNO_PAUSA_CRITICA', 'SAIDA', 'ENTRADA_HE', 'SAIDA_HE', 'ENTRADA_COMPENSACAO', 'SAIDA_COMPENSACAO');

-- CreateEnum
CREATE TYPE "CanalMarcacao" AS ENUM ('TOTEM', 'APP_MOBILE', 'WEB');

-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('INCLUSAO', 'ALTERACAO', 'EXCLUSAO');

-- CreateEnum
CREATE TYPE "StatusPonto" AS ENUM ('FALTA', 'ATESTADO', 'AFASTAMENTO_INSS', 'FOLGA', 'FERIAS', 'DSR', 'SUSPENSAO', 'LICENCA_MATERNIDADE', 'LICENCA_PATERNIDADE', 'LICENCA_NAO_REMUNERADA', 'LICENCA_OUTRAS', 'FERIADO', 'COMPENSADO', 'A_COMPENSAR', 'PAUSA_NR17', 'PAUSA_FISIOLOGICA', 'PAUSA_OCORRENCIA_CRITICA');

-- CreateEnum
CREATE TYPE "TipoFeriado" AS ENUM ('NACIONAL', 'ESTADUAL', 'MUNICIPAL', 'FACULTATIVO');

-- CreateEnum
CREATE TYPE "ModalidadeBancoHoras" AS ENUM ('ACORDO_INDIVIDUAL', 'ACT_CCT', 'COMPENSACAO_MENSAL');

-- CreateEnum
CREATE TYPE "StatusHE" AS ENUM ('PENDENTE_ACEITE', 'ACEITA', 'RECUSADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "StatusAjuste" AS ENUM ('PENDENTE_GESTOR', 'APROVADO_GESTOR', 'REPROVADO_GESTOR', 'PENDENTE_RH', 'APROVADO_RH', 'REPROVADO_RH');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "razao_social" VARCHAR(150) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CnpjEstabelecimento" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "tenant_id" UUID NOT NULL,
    "cnpj" CHAR(14) NOT NULL,
    "razao_social" VARCHAR(150) NOT NULL,
    "uf" CHAR(2) NOT NULL,
    "fuso_horario" VARCHAR(50) NOT NULL,
    "cno_caepf" VARCHAR(14),
    "endereco" VARCHAR(300) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "nsr_contador" BIGINT NOT NULL DEFAULT 1,

    CONSTRAINT "CnpjEstabelecimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Colaborador" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "tenant_id" UUID NOT NULL,
    "cnpj_estab_id" UUID NOT NULL,
    "nome_completo" VARCHAR(100) NOT NULL,
    "cpf" CHAR(11) NOT NULL,
    "pis_nit" CHAR(11) NOT NULL,
    "matricula" VARCHAR(50) NOT NULL,
    "regime" "RegimeTrabalhista" NOT NULL,
    "data_admissao" DATE NOT NULL,
    "centro_custo" VARCHAR(100) NOT NULL,
    "operacao_cliente" VARCHAR(100) NOT NULL,
    "email_corporativo" VARCHAR(255),
    "whatsapp" VARCHAR(20),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "data_desligamento" DATE,
    "onboarding_ok" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Colaborador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColaboradorJornada" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "colaborador_id" UUID NOT NULL,
    "jornada_id" UUID NOT NULL,
    "data_inicio" DATE NOT NULL,
    "data_fim" DATE,
    "usuario_id" UUID NOT NULL,

    CONSTRAINT "ColaboradorJornada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AceiteLgpd" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "colaborador_id" UUID NOT NULL,
    "timestamp_aceite" TIMESTAMP(3) NOT NULL,
    "ip" VARCHAR(45) NOT NULL,
    "versao_aviso" VARCHAR(20) NOT NULL,

    CONSTRAINT "AceiteLgpd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "colaborador_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "perfil" "PerfilAcesso" NOT NULL,
    "senha_hash" VARCHAR(255) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jornada" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "tipo" "TipoJornada" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "hora_inicio" VARCHAR(5) NOT NULL,
    "hora_fim" VARCHAR(5) NOT NULL,
    "dias_semana" INTEGER[],
    "valida_feriado" BOOLEAN NOT NULL DEFAULT false,
    "hora_inicio_sab" VARCHAR(5),
    "hora_fim_sab" VARCHAR(5),
    "hora_inicio_dom" VARCHAR(5),
    "hora_fim_dom" VARCHAR(5),
    "tolerancia_atraso_entrada" INTEGER NOT NULL DEFAULT 5,
    "tolerancia_atraso_intervalo" INTEGER NOT NULL DEFAULT 5,
    "tolerancia_antec_saida" INTEGER NOT NULL DEFAULT 5,
    "tolerancia_antec_inicio_interv" INTEGER NOT NULL DEFAULT 5,
    "janela_marcacao_min" INTEGER NOT NULL DEFAULT 15,
    "intervalo_minimo_jornadas" INTEGER NOT NULL DEFAULT 660,
    "requer_act" BOOLEAN NOT NULL DEFAULT false,
    "ciente_art59a" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Jornada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PausaConfig" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jornada_id" UUID NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "ordem" INTEGER NOT NULL,
    "duracao_min" INTEGER NOT NULL,
    "eh_nr17" BOOLEAN NOT NULL DEFAULT false,
    "eh_intervalo_refeicao" BOOLEAN NOT NULL DEFAULT false,
    "computa_jornada" BOOLEAN NOT NULL DEFAULT true,
    "janela_inicio_min" INTEGER,
    "janela_fim_min" INTEGER,

    CONSTRAINT "PausaConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Escala" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Escala_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscalaJornada" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escala_id" UUID NOT NULL,
    "jornada_id" UUID NOT NULL,
    "dia_semana" INTEGER NOT NULL,

    CONSTRAINT "EscalaJornada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feriado" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" UUID,
    "nome" VARCHAR(100) NOT NULL,
    "tipo" "TipoFeriado" NOT NULL,
    "uf" CHAR(2),
    "municipio" VARCHAR(100),
    "data_inicio" DATE NOT NULL,
    "data_fim" DATE NOT NULL,

    CONSTRAINT "Feriado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Act" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sindicato" VARCHAR(200) NOT NULL,
    "uf" CHAR(2) NOT NULL,
    "data_inicio" DATE NOT NULL,
    "data_fim" DATE NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "tolerancia_ampliada_min" INTEGER,
    "banco_horas_meses" INTEGER,
    "periodicidade_fechamento" TEXT,
    "comprovante_eletronico" BOOLEAN NOT NULL DEFAULT false,
    "he_comum_aliquota" DECIMAL(5,2) NOT NULL DEFAULT 50,
    "he_feriado_aliquota" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "he_dsr_aliquota" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "adicional_noturno_aliquota" DECIMAL(5,2) NOT NULL DEFAULT 20,

    CONSTRAINT "Act_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Marcacao" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" UUID NOT NULL,
    "cnpj_estab_id" UUID NOT NULL,
    "colaborador_id" UUID NOT NULL,
    "nsr" BIGINT NOT NULL,
    "timestamp_marcacao" TIMESTAMP(3) NOT NULL,
    "timestamp_gravacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" "TipoMarcacao" NOT NULL,
    "canal" "CanalMarcacao" NOT NULL,
    "hash_sha256" CHAR(64) NOT NULL,
    "imagem_ref" VARCHAR(500),
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "fora_da_area" BOOLEAN NOT NULL DEFAULT false,
    "fora_da_janela" BOOLEAN NOT NULL DEFAULT false,
    "crpt_gerado" BOOLEAN NOT NULL DEFAULT false,
    "crpt_url" VARCHAR(500),

    CONSTRAINT "Marcacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeExtra" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "tenant_id" UUID NOT NULL,
    "colaborador_id" UUID NOT NULL,
    "gestor_id" UUID NOT NULL,
    "data" DATE NOT NULL,
    "hora_inicio" VARCHAR(5) NOT NULL,
    "hora_fim" VARCHAR(5) NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "status" "StatusHE" NOT NULL DEFAULT 'PENDENTE_ACEITE',
    "motivo" VARCHAR(300),
    "timestamp_aceite" TIMESTAMP(3),

    CONSTRAINT "HeExtra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BancoHoras" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" UUID NOT NULL,
    "colaborador_id" UUID NOT NULL,
    "data_referencia" DATE NOT NULL,
    "minutos" INTEGER NOT NULL,
    "descricao" VARCHAR(200) NOT NULL,
    "modalidade" "ModalidadeBancoHoras" NOT NULL,
    "data_vencimento" DATE NOT NULL,
    "compensado" BOOLEAN NOT NULL DEFAULT false,
    "marcacao_ref" UUID,

    CONSTRAINT "BancoHoras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MotivoAjuste" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" UUID NOT NULL,
    "descricao" VARCHAR(200) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "flag_desconto_va" BOOLEAN NOT NULL DEFAULT false,
    "flag_desconto_vt" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MotivoAjuste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ajuste" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "tenant_id" UUID NOT NULL,
    "colaborador_id" UUID NOT NULL,
    "solicitante_id" UUID NOT NULL,
    "marcacao_ref_id" UUID,
    "motivo_id" UUID NOT NULL,
    "status" "StatusAjuste" NOT NULL DEFAULT 'PENDENTE_GESTOR',
    "data_ponto" DATE NOT NULL,
    "tipo_ajuste" VARCHAR(50) NOT NULL,
    "novo_timestamp" TIMESTAMP(3),
    "novo_tipo" "TipoMarcacao",
    "justificativa" VARCHAR(500) NOT NULL,
    "gestor_id" UUID,
    "gestor_obs" VARCHAR(300),
    "gestor_at" TIMESTAMP(3),
    "rh_id" UUID,
    "rh_obs" VARCHAR(300),
    "rh_at" TIMESTAMP(3),

    CONSTRAINT "Ajuste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodoFechamento" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "tenant_id" UUID NOT NULL,
    "data_inicio" DATE NOT NULL,
    "data_fim" DATE NOT NULL,
    "fechado" BOOLEAN NOT NULL DEFAULT false,
    "fechado_at" TIMESTAMP(3),
    "fechado_por" UUID,

    CONSTRAINT "PeriodoFechamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EspelhoPonto" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" UUID NOT NULL,
    "periodo_id" UUID NOT NULL,
    "colaborador_id" UUID NOT NULL,
    "pdf_url" VARCHAR(500),
    "assinado" BOOLEAN NOT NULL DEFAULT false,
    "assinado_at" TIMESTAMP(3),
    "assinado_ip" VARCHAR(45),
    "nao_manifestado" BOOLEAN NOT NULL DEFAULT false,
    "nao_manifestado_at" TIMESTAMP(3),

    CONSTRAINT "EspelhoPonto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeracaoArquivoFiscal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" UUID NOT NULL,
    "cnpj_estab_id" UUID NOT NULL,
    "tipo" VARCHAR(3) NOT NULL,
    "data_inicio" DATE NOT NULL,
    "data_fim" DATE NOT NULL,
    "solicitante_id" UUID NOT NULL,
    "arquivo_url" VARCHAR(500),
    "assinatura_url" VARCHAR(500),
    "concluido" BOOLEAN NOT NULL DEFAULT false,
    "erro" VARCHAR(500),

    CONSTRAINT "GeracaoArquivoFiscal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AfdRegistro" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cnpj_estab_id" UUID NOT NULL,
    "nsr" BIGINT NOT NULL,
    "tipo_registro" INTEGER NOT NULL,
    "conteudo_raw" TEXT NOT NULL,

    CONSTRAINT "AfdRegistro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CnpjEstabelecimento_tenant_id_idx" ON "CnpjEstabelecimento"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "CnpjEstabelecimento_cnpj_key" ON "CnpjEstabelecimento"("cnpj");

-- CreateIndex
CREATE INDEX "Colaborador_tenant_id_idx" ON "Colaborador"("tenant_id");

-- CreateIndex
CREATE INDEX "Colaborador_cnpj_estab_id_idx" ON "Colaborador"("cnpj_estab_id");

-- CreateIndex
CREATE UNIQUE INDEX "Colaborador_tenant_id_cpf_key" ON "Colaborador"("tenant_id", "cpf");

-- CreateIndex
CREATE UNIQUE INDEX "Colaborador_tenant_id_matricula_key" ON "Colaborador"("tenant_id", "matricula");

-- CreateIndex
CREATE INDEX "ColaboradorJornada_colaborador_id_idx" ON "ColaboradorJornada"("colaborador_id");

-- CreateIndex
CREATE UNIQUE INDEX "AceiteLgpd_colaborador_id_key" ON "AceiteLgpd"("colaborador_id");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_colaborador_id_key" ON "Usuario"("colaborador_id");

-- CreateIndex
CREATE INDEX "Usuario_tenant_id_idx" ON "Usuario"("tenant_id");

-- CreateIndex
CREATE INDEX "Jornada_tenant_id_idx" ON "Jornada"("tenant_id");

-- CreateIndex
CREATE INDEX "PausaConfig_jornada_id_idx" ON "PausaConfig"("jornada_id");

-- CreateIndex
CREATE INDEX "Escala_tenant_id_idx" ON "Escala"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "EscalaJornada_escala_id_dia_semana_key" ON "EscalaJornada"("escala_id", "dia_semana");

-- CreateIndex
CREATE INDEX "Feriado_tenant_id_idx" ON "Feriado"("tenant_id");

-- CreateIndex
CREATE INDEX "Feriado_uf_data_inicio_idx" ON "Feriado"("uf", "data_inicio");

-- CreateIndex
CREATE INDEX "Act_tenant_id_idx" ON "Act"("tenant_id");

-- CreateIndex
CREATE INDEX "Marcacao_tenant_id_colaborador_id_timestamp_marcacao_idx" ON "Marcacao"("tenant_id", "colaborador_id", "timestamp_marcacao");

-- CreateIndex
CREATE INDEX "Marcacao_cnpj_estab_id_timestamp_marcacao_idx" ON "Marcacao"("cnpj_estab_id", "timestamp_marcacao");

-- CreateIndex
CREATE UNIQUE INDEX "Marcacao_cnpj_estab_id_nsr_key" ON "Marcacao"("cnpj_estab_id", "nsr");

-- CreateIndex
CREATE INDEX "HeExtra_tenant_id_colaborador_id_data_idx" ON "HeExtra"("tenant_id", "colaborador_id", "data");

-- CreateIndex
CREATE INDEX "BancoHoras_tenant_id_colaborador_id_data_referencia_idx" ON "BancoHoras"("tenant_id", "colaborador_id", "data_referencia");

-- CreateIndex
CREATE INDEX "BancoHoras_tenant_id_colaborador_id_data_vencimento_idx" ON "BancoHoras"("tenant_id", "colaborador_id", "data_vencimento");

-- CreateIndex
CREATE INDEX "MotivoAjuste_tenant_id_idx" ON "MotivoAjuste"("tenant_id");

-- CreateIndex
CREATE INDEX "Ajuste_tenant_id_colaborador_id_data_ponto_idx" ON "Ajuste"("tenant_id", "colaborador_id", "data_ponto");

-- CreateIndex
CREATE INDEX "Ajuste_tenant_id_status_idx" ON "Ajuste"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "PeriodoFechamento_tenant_id_data_inicio_idx" ON "PeriodoFechamento"("tenant_id", "data_inicio");

-- CreateIndex
CREATE INDEX "EspelhoPonto_tenant_id_colaborador_id_idx" ON "EspelhoPonto"("tenant_id", "colaborador_id");

-- CreateIndex
CREATE UNIQUE INDEX "EspelhoPonto_periodo_id_colaborador_id_key" ON "EspelhoPonto"("periodo_id", "colaborador_id");

-- CreateIndex
CREATE INDEX "GeracaoArquivoFiscal_tenant_id_cnpj_estab_id_idx" ON "GeracaoArquivoFiscal"("tenant_id", "cnpj_estab_id");

-- CreateIndex
CREATE INDEX "AfdRegistro_cnpj_estab_id_tipo_registro_idx" ON "AfdRegistro"("cnpj_estab_id", "tipo_registro");

-- CreateIndex
CREATE UNIQUE INDEX "AfdRegistro_cnpj_estab_id_nsr_key" ON "AfdRegistro"("cnpj_estab_id", "nsr");

-- AddForeignKey
ALTER TABLE "CnpjEstabelecimento" ADD CONSTRAINT "CnpjEstabelecimento_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Colaborador" ADD CONSTRAINT "Colaborador_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Colaborador" ADD CONSTRAINT "Colaborador_cnpj_estab_id_fkey" FOREIGN KEY ("cnpj_estab_id") REFERENCES "CnpjEstabelecimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColaboradorJornada" ADD CONSTRAINT "ColaboradorJornada_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "Colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColaboradorJornada" ADD CONSTRAINT "ColaboradorJornada_jornada_id_fkey" FOREIGN KEY ("jornada_id") REFERENCES "Jornada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AceiteLgpd" ADD CONSTRAINT "AceiteLgpd_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "Colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "Colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Jornada" ADD CONSTRAINT "Jornada_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PausaConfig" ADD CONSTRAINT "PausaConfig_jornada_id_fkey" FOREIGN KEY ("jornada_id") REFERENCES "Jornada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escala" ADD CONSTRAINT "Escala_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalaJornada" ADD CONSTRAINT "EscalaJornada_escala_id_fkey" FOREIGN KEY ("escala_id") REFERENCES "Escala"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalaJornada" ADD CONSTRAINT "EscalaJornada_jornada_id_fkey" FOREIGN KEY ("jornada_id") REFERENCES "Jornada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feriado" ADD CONSTRAINT "Feriado_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Act" ADD CONSTRAINT "Act_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marcacao" ADD CONSTRAINT "Marcacao_cnpj_estab_id_fkey" FOREIGN KEY ("cnpj_estab_id") REFERENCES "CnpjEstabelecimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marcacao" ADD CONSTRAINT "Marcacao_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "Colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeExtra" ADD CONSTRAINT "HeExtra_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "Colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotivoAjuste" ADD CONSTRAINT "MotivoAjuste_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ajuste" ADD CONSTRAINT "Ajuste_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "Colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ajuste" ADD CONSTRAINT "Ajuste_marcacao_ref_id_fkey" FOREIGN KEY ("marcacao_ref_id") REFERENCES "Marcacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ajuste" ADD CONSTRAINT "Ajuste_motivo_id_fkey" FOREIGN KEY ("motivo_id") REFERENCES "MotivoAjuste"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EspelhoPonto" ADD CONSTRAINT "EspelhoPonto_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "PeriodoFechamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AfdRegistro" ADD CONSTRAINT "AfdRegistro_cnpj_estab_id_fkey" FOREIGN KEY ("cnpj_estab_id") REFERENCES "CnpjEstabelecimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
