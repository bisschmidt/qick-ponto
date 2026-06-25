'use client'

import React, { useActionState, useTransition, useState } from 'react'
import {
  salvarPerfilAction,
  salvarConfigMarcacaoAction,
  definirSenhaAction,
  aceitarLgpdAction,
  reenviarConviteAction,
  salvarCodigoFolhaAction,
  desligarAction,
  reativarAction,
} from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Loader2, Save, Key, ShieldCheck, Mail, FileSpreadsheet, CheckCircle2, UserX, RotateCcw,
  User, Briefcase, Lock, HelpCircle, Smartphone, Monitor, Tablet, ScanFace, History, Plane,
  AlertTriangle,
} from 'lucide-react'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Colaborador {
  id: string
  nome_completo: string
  nome_social: string | null
  usar_nome_social: boolean
  cpf: string
  pis_nit: string
  matricula: string
  email_corporativo: string | null
  whatsapp: string | null
  centro_custo: string
  operacao_cliente: string
  cargo: string | null
  time_nome: string | null
  departamento: string | null
  validacao_facial: boolean
  canal_app: boolean
  canal_quiosque: boolean
  canal_computador: boolean
  onboarding_ok: boolean
  ativo: boolean
  data_desligamento: string | null
  cnpj_estab: { id: string; cnpj: string; razao_social: string; uf: string } | null
  usuario: { perfil: string } | null
}

interface MarcacaoHist {
  id: string
  nsr: string
  tipo: string
  canal: string
  timestamp_marcacao: string
  fora_da_area: boolean
  fora_da_janela: boolean
  ajustes: {
    id: string
    tipo_ajuste: string
    status: string
    justificativa: string
    novo_timestamp: string | null
    novo_tipo: string | null
    created_at: string
  }[]
}

interface Dispositivo {
  canal: string
  total: number
  primeiro: string
  ultimo: string
  foraDaArea: number
}

interface Props {
  colaborador: Colaborador
  jornadaAtual: { id: string; nome: string } | null
  jornadas: { id: string; nome: string }[]
  codigoQuestor: string
  userRole: string
  marcacoes: MarcacaoHist[]
  dispositivos: Dispositivo[]
}

// ── Helpers de exibição ─────────────────────────────────────────────────────────

const CANAL_LABEL: Record<string, { label: string; icon: React.ReactNode }> = {
  TOTEM:      { label: 'Quiosque',    icon: <Tablet className="h-4 w-4" /> },
  APP_MOBILE: { label: 'Aplicativo',  icon: <Smartphone className="h-4 w-4" /> },
  WEB:        { label: 'Computador',  icon: <Monitor className="h-4 w-4" /> },
}

const TIPO_LABEL: Record<string, string> = {
  ENTRADA: 'Entrada',
  SAIDA: 'Saída',
  SAIDA_PAUSA_NR17: 'Saída pausa NR-17',
  RETORNO_PAUSA_NR17: 'Retorno pausa NR-17',
  SAIDA_INTERVALO: 'Saída de intervalo',
  RETORNO_INTERVALO: 'Retorno de intervalo',
  SAIDA_PAUSA_FISIOLOGICA: 'Saída pausa fisiológica',
  RETORNO_PAUSA_FISIOLOGICA: 'Retorno pausa fisiológica',
  ENTRADA_HE: 'Entrada HE',
  SAIDA_HE: 'Saída HE',
  ENTRADA_COMPENSACAO: 'Entrada compensação',
  SAIDA_COMPENSACAO: 'Saída compensação',
}

const PERFIL_LABEL: Record<string, string> = {
  ADMIN_TENANT: 'Administrador',
  GESTOR: 'Gestor',
  RH_DP: 'RH / DP',
  COLABORADOR: 'Colaborador',
  AUDITOR: 'Auditor',
}

function fmtCpf(cpf: string): string {
  if (cpf.length !== 11) return cpf
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`
}

function fmtPis(pis: string): string {
  if (pis.length !== 11) return pis
  return `${pis.slice(0, 3)}.${pis.slice(3, 8)}.${pis.slice(8, 10)}-${pis.slice(10)}`
}

function fmtCnpj(cnpj: string): string {
  if (cnpj.length !== 14) return cnpj
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`
}

function fmtDataHora(iso: string): string {
  const d = new Date(iso)
  const brt = new Date(d.getTime() - 3 * 3600 * 1000)
  const dd = String(brt.getUTCDate()).padStart(2, '0')
  const mm = String(brt.getUTCMonth() + 1).padStart(2, '0')
  const yy = brt.getUTCFullYear()
  const hh = String(brt.getUTCHours()).padStart(2, '0')
  const mi = String(brt.getUTCMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yy} ${hh}:${mi}`
}

// ── Componentes utilitários ──────────────────────────────────────────────────────

function Hint({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <HelpCircle className="h-3.5 w-3.5 text-gray-400 cursor-help" />
      <span className="invisible group-hover:visible absolute left-5 top-0 z-20 w-56 rounded-md bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg">
        {text}
      </span>
    </span>
  )
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!on)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        on ? 'bg-blue-600' : 'bg-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

function ReadonlyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
        {label}
        {hint && <Hint text={hint} />}
      </label>
      <div className="flex h-10 w-full items-center rounded-md border border-gray-200 bg-gray-50 px-3 text-sm text-gray-600 font-mono">
        {value || '—'}
      </div>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────────

type Aba = 'detalhes' | 'dispositivos' | 'historico' | 'ausencia' | 'config'

const ABAS: { id: Aba; label: string; icon: React.ReactNode }[] = [
  { id: 'detalhes',     label: 'Detalhes',           icon: <User className="h-4 w-4" /> },
  { id: 'dispositivos', label: 'Dispositivos',       icon: <Tablet className="h-4 w-4" /> },
  { id: 'historico',    label: 'Histórico de pontos',icon: <History className="h-4 w-4" /> },
  { id: 'ausencia',     label: 'Ausência e Férias',  icon: <Plane className="h-4 w-4" /> },
  { id: 'config',       label: 'Configurações',      icon: <ScanFace className="h-4 w-4" /> },
]

export function FichaColaboradorClient(props: Props) {
  const [aba, setAba] = useState<Aba>('detalhes')

  return (
    <div className="space-y-5">
      {/* Abas */}
      <div className="border-b border-gray-200 flex gap-1 overflow-x-auto">
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              aba === a.id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {a.icon}
            {a.label}
          </button>
        ))}
      </div>

      {aba === 'detalhes'     && <AbaDetalhes {...props} />}
      {aba === 'dispositivos' && <AbaDispositivos dispositivos={props.dispositivos} />}
      {aba === 'historico'    && <AbaHistorico marcacoes={props.marcacoes} />}
      {aba === 'ausencia'     && <AbaAusencia colaboradorId={props.colaborador.id} />}
      {aba === 'config'       && <AbaConfig {...props} />}
    </div>
  )
}

// ── ABA: DETALHES (com sub-navegação lateral) ────────────────────────────────────

type SubDetalhe = 'pessoais' | 'profissionais' | 'permissoes'

function AbaDetalhes({ colaborador, jornadaAtual, jornadas, codigoQuestor, userRole }: Props) {
  const [sub, setSub] = useState<SubDetalhe>('pessoais')

  // Estado dos campos editáveis (pessoais + profissionais)
  const [nomeCompleto, setNomeCompleto] = useState(colaborador.nome_completo)
  const [nomeSocial, setNomeSocial] = useState(colaborador.nome_social ?? '')
  const [usarNomeSocial, setUsarNomeSocial] = useState(colaborador.usar_nome_social)
  const [email, setEmail] = useState(colaborador.email_corporativo ?? '')
  const [whatsapp, setWhatsapp] = useState(colaborador.whatsapp ?? '')
  const [centroCusto, setCentroCusto] = useState(colaborador.centro_custo)
  const [operacao, setOperacao] = useState(colaborador.operacao_cliente)
  const [cargo, setCargo] = useState(colaborador.cargo ?? '')
  const [time, setTime] = useState(colaborador.time_nome ?? '')
  const [departamento, setDepartamento] = useState(colaborador.departamento ?? '')
  const [novaJornadaId, setNovaJornadaId] = useState('')

  const [pending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  function salvar() {
    setErro(null); setOk(false)
    startTransition(async () => {
      const r = await salvarPerfilAction({
        id: colaborador.id,
        nome_completo: nomeCompleto,
        nome_social: nomeSocial,
        usar_nome_social: usarNomeSocial,
        email_corporativo: email,
        whatsapp,
        centro_custo: centroCusto,
        operacao_cliente: operacao,
        cargo,
        time_nome: time,
        departamento,
        ...(novaJornadaId ? { nova_jornada_id: novaJornadaId } : {}),
      })
      if (r?.ok) { setOk(true); setNovaJornadaId('') }
      else setErro(r?.ok === false ? r.error : 'Erro ao salvar')
    })
  }

  const SUBS: { id: SubDetalhe; label: string; icon: React.ReactNode }[] = [
    { id: 'pessoais',      label: 'Detalhes pessoais',     icon: <User className="h-4 w-4" /> },
    { id: 'profissionais', label: 'Detalhes profissionais',icon: <Briefcase className="h-4 w-4" /> },
    { id: 'permissoes',    label: 'Permissões',            icon: <Lock className="h-4 w-4" /> },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5">
      {/* Sub-nav lateral */}
      <nav className="space-y-1">
        {SUBS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSub(s.id)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors ${
              sub === s.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
      </nav>

      <div className="space-y-4">
        {sub === 'pessoais' && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  Nome completo (civil)
                  <Hint text="Nome civil — usado SEMPRE em documentos legais, AFD e arquivos fiscais." />
                </label>
                <Input value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Nome social (opcional)</label>
                <Input value={nomeSocial} onChange={(e) => setNomeSocial(e.target.value)} placeholder="Como o colaborador prefere ser chamado" />
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer pt-1">
                  <input type="checkbox" checked={usarNomeSocial} onChange={(e) => setUsarNomeSocial(e.target.checked)} className="h-4 w-4 rounded" />
                  Usar nome social
                </label>
                {usarNomeSocial && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1.5">
                    O nome social será o exibido nas telas e no app. O nome civil continua nos documentos
                    legais (AFD, AEJ, comprovantes).
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <ReadonlyField label="CPF" value={fmtCpf(colaborador.cpf)} hint="Obrigatório. Vai no registro tipo 7 do AFD. Imutável pela ficha." />
                <ReadonlyField label="PIS / NIT" value={fmtPis(colaborador.pis_nit)} hint="Obrigatório para identificação fiscal do trabalhador. Imutável pela ficha." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <ReadonlyField label="Matrícula" value={colaborador.matricula} hint="Identificador único do colaborador no tenant. Imutável pela ficha." />
                <div />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">E-mail corporativo</label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">WhatsApp</label>
                  <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="11999999999" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {sub === 'profissionais' && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Centro de custo</label>
                  <Input value={centroCusto} onChange={(e) => setCentroCusto(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Cargo</label>
                  <Input value={cargo} onChange={(e) => setCargo(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Time</label>
                  <Input value={time} onChange={(e) => setTime(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Departamento</label>
                  <Input value={departamento} onChange={(e) => setDepartamento(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <ReadonlyField
                  label="CNPJ de lotação"
                  value={colaborador.cnpj_estab ? fmtCnpj(colaborador.cnpj_estab.cnpj) : '—'}
                  hint="Estabelecimento de lotação — define qual AFD é gerado para este colaborador. Crítico: não confundir com filial genérica."
                />
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    Operação / Cliente
                    <Hint text="Referência de BPO para relatórios por contrato. Pode trocar sem trocar de empregador." />
                  </label>
                  <Input value={operacao} onChange={(e) => setOperacao(e.target.value)} />
                </div>
              </div>

              {colaborador.cnpj_estab && (
                <p className="text-xs text-gray-500">
                  {colaborador.cnpj_estab.razao_social} · {colaborador.cnpj_estab.uf}
                </p>
              )}

              <div className="pt-3 border-t space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Jornada de trabalho {jornadaAtual && <span className="text-gray-400 font-normal">— atual: {jornadaAtual.nome}</span>}
                </label>
                <select
                  value={novaJornadaId}
                  onChange={(e) => setNovaJornadaId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">{jornadaAtual ? 'Manter atual' : 'Vincular jornada'}</option>
                  {jornadas.filter((j) => j.id !== jornadaAtual?.id).map((j) => (
                    <option key={j.id} value={j.id}>{j.nome}</option>
                  ))}
                </select>
              </div>

              <CodigoFolha colaboradorId={colaborador.id} codigoQuestor={codigoQuestor} />
            </CardContent>
          </Card>
        )}

        {sub === 'permissoes' && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-gray-500" />
                <h2 className="font-semibold text-gray-700">Perfil de acesso</h2>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="text-sm">
                  {colaborador.usuario ? (PERFIL_LABEL[colaborador.usuario.perfil] ?? colaborador.usuario.perfil) : 'Sem usuário'}
                </Badge>
              </div>
              <p className="text-sm text-gray-500">
                Define o que o colaborador pode acessar no sistema. A alteração de perfil é feita pelo
                administrador do tenant — fale com o suporte para mudanças de função.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Barra de salvar (apenas para pessoais/profissionais) */}
        {sub !== 'permissoes' && (
          <div className="flex items-center gap-3">
            <Button onClick={salvar} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar alterações
            </Button>
            {ok && <p className="text-sm text-green-600">Salvo com sucesso</p>}
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            {userRole !== 'ADMIN_TENANT' && (
              <p className="text-xs text-gray-400">Edição liberada apenas para administradores.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Código no sistema de folha (Questor) — reaproveita a action existente
function CodigoFolha({ colaboradorId, codigoQuestor }: { colaboradorId: string; codigoQuestor: string }) {
  const [codigo, setCodigo] = useState(codigoQuestor)
  const [pending, startTransition] = useTransition()
  const [ok, setOk] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function salvar() {
    setErro(null); setOk(false)
    if (!codigo.trim()) { setErro('Informe o código'); return }
    startTransition(async () => {
      const r = await salvarCodigoFolhaAction({ colaborador_id: colaboradorId, sistema: 'QUESTOR', codigo: codigo.trim() })
      if (r.ok) setOk(true)
      else setErro(r.error)
    })
  }

  return (
    <div className="pt-3 border-t space-y-2">
      <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
        <FileSpreadsheet className="h-4 w-4 text-gray-500" />
        Código de funcionário na folha (Questor)
        <Hint text="Necessário para exportar os eventos de folha (HE, faltas) para o Questor." />
      </label>
      <div className="flex gap-2">
        <Input value={codigo} onChange={(e) => { setCodigo(e.target.value); setOk(false) }} placeholder="ex.: 9001" maxLength={20} />
        <Button variant="outline" onClick={salvar} disabled={pending} className="shrink-0">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </Button>
      </div>
      {ok && <p className="text-sm text-green-600">Código salvo</p>}
      {erro && <p className="text-sm text-red-600">{erro}</p>}
    </div>
  )
}

// ── ABA: DISPOSITIVOS ────────────────────────────────────────────────────────────

function AbaDispositivos({ dispositivos }: { dispositivos: Dispositivo[] }) {
  if (dispositivos.length === 0) {
    return (
      <Card><CardContent className="py-10 text-center text-sm text-gray-500">
        Nenhuma marcação registrada ainda — sem dispositivos para exibir.
      </CardContent></Card>
    )
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        Canais a partir dos quais o colaborador registrou ponto. Marcações fora da área autorizada são
        sinalizadas como apoio ao antifraude.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {dispositivos.map((d) => {
          const meta = CANAL_LABEL[d.canal] ?? { label: d.canal, icon: <Tablet className="h-4 w-4" /> }
          return (
            <Card key={d.canal}>
              <CardContent className="pt-5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium text-gray-800">
                    {meta.icon}{meta.label}
                  </div>
                  {d.foraDaArea > 0 && (
                    <Badge variant="destructive" className="text-xs flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> {d.foraDaArea} fora da área
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-gray-600">{d.total} marcação(ões)</div>
                <div className="text-xs text-gray-400">
                  Primeira: {fmtDataHora(d.primeiro)} · Última: {fmtDataHora(d.ultimo)}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ── ABA: HISTÓRICO DE PONTOS ─────────────────────────────────────────────────────

function AbaHistorico({ marcacoes }: { marcacoes: MarcacaoHist[] }) {
  if (marcacoes.length === 0) {
    return (
      <Card><CardContent className="py-10 text-center text-sm text-gray-500">
        Nenhuma marcação registrada.
      </CardContent></Card>
    )
  }
  return (
    <Card>
      <CardContent className="p-0">
        <div className="px-3 py-2 text-xs text-gray-500 border-b bg-gray-50">
          Marcações brutas (imutáveis). Ajustes aparecem como eventos separados, referenciando o NSR original.
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase border-b">
            <tr>
              <th className="text-left px-3 py-2 font-medium">NSR</th>
              <th className="text-left px-3 py-2 font-medium">Data / hora</th>
              <th className="text-left px-3 py-2 font-medium">Tipo</th>
              <th className="text-left px-3 py-2 font-medium">Canal</th>
              <th className="text-right px-3 py-2 font-medium">Sinais</th>
            </tr>
          </thead>
          <tbody>
            {marcacoes.map((m) => {
              const canal = CANAL_LABEL[m.canal] ?? { label: m.canal, icon: null }
              return (
                <React.Fragment key={m.id}>
                  <tr className="border-b last:border-0">
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{m.nsr}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{fmtDataHora(m.timestamp_marcacao)}</td>
                    <td className="px-3 py-2.5">{TIPO_LABEL[m.tipo] ?? m.tipo}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1 text-xs text-gray-600">{canal.icon}{canal.label}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        {m.fora_da_area && <Badge variant="destructive" className="text-[10px]">Fora da área</Badge>}
                        {m.fora_da_janela && <Badge variant="warning" className="text-[10px]">Fora da janela</Badge>}
                      </div>
                    </td>
                  </tr>
                  {m.ajustes.map((a) => (
                    <tr key={a.id} className="border-b last:border-0 bg-blue-50/40">
                      <td className="px-3 py-2 text-xs text-blue-400 pl-6">↳ ajuste</td>
                      <td className="px-3 py-2 text-xs text-gray-600" colSpan={3}>
                        <span className="font-medium">{a.tipo_ajuste}</span>
                        {a.novo_tipo && a.novo_timestamp && (
                          <> → {TIPO_LABEL[a.novo_tipo] ?? a.novo_tipo} {fmtDataHora(a.novo_timestamp)}</>
                        )}
                        {a.justificativa && <span className="text-gray-400 italic"> · "{a.justificativa}"</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Badge variant="secondary" className="text-[10px]">{a.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

// ── ABA: AUSÊNCIA E FÉRIAS ───────────────────────────────────────────────────────

function AbaAusencia({ colaboradorId }: { colaboradorId: string }) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-center gap-2">
          <Plane className="h-4 w-4 text-gray-500" />
          <h2 className="font-semibold text-gray-700">Ausências e férias</h2>
        </div>
        <p className="text-sm text-gray-500">
          Atestados, afastamentos e férias deste colaborador são tratados na ficha mensal de ponto,
          onde aparecem como status do dia (Atestado, Férias, Afastamento) e alimentam a apuração.
        </p>
        <a
          href={`/dashboard/equipe/colaborador/${colaboradorId}`}
          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800"
        >
          <History className="h-4 w-4" /> Abrir ficha mensal de ponto
        </a>
      </CardContent>
    </Card>
  )
}

// ── ABA: CONFIGURAÇÕES ───────────────────────────────────────────────────────────

function AbaConfig(props: Props) {
  const { colaborador, userRole } = props
  const podeDesligar = userRole === 'ADMIN_TENANT' || userRole === 'RH_DP'

  return (
    <div className="space-y-5">
      <ConfigMarcacao colaborador={colaborador} />
      <SenhaCard colaboradorId={colaborador.id} />
      <ConviteCard colaborador={colaborador} />
      <LgpdCard colaborador={colaborador} />
      {podeDesligar && <DesligamentoCard colaborador={colaborador} />}
    </div>
  )
}

function ConfigMarcacao({ colaborador }: { colaborador: Colaborador }) {
  const [facial, setFacial] = useState(colaborador.validacao_facial)
  const [app, setApp] = useState(colaborador.canal_app)
  const [quiosque, setQuiosque] = useState(colaborador.canal_quiosque)
  const [computador, setComputador] = useState(colaborador.canal_computador)
  const [pending, startTransition] = useTransition()
  const [ok, setOk] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function salvar() {
    setErro(null); setOk(false)
    startTransition(async () => {
      const r = await salvarConfigMarcacaoAction(colaborador.id, {
        validacao_facial: facial,
        canal_app: app,
        canal_quiosque: quiosque,
        canal_computador: computador,
      })
      if (r?.ok) setOk(true)
      else setErro(r?.ok === false ? r.error : 'Erro ao salvar')
    })
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-5">
        <div>
          <h2 className="font-semibold text-gray-700">Canais de marcação</h2>
          <p className="text-sm text-gray-500 mt-0.5">Onde este colaborador pode registrar o ponto.</p>
        </div>

        <div className="space-y-3">
          <LinhaToggle icon={<Smartphone className="h-4 w-4 text-gray-500" />} label="Aplicativo" on={app} onChange={setApp} />
          <LinhaToggle icon={<Tablet className="h-4 w-4 text-gray-500" />} label="Quiosque (tablet/totem)" on={quiosque} onChange={setQuiosque} />
          <LinhaToggle icon={<Monitor className="h-4 w-4 text-gray-500" />} label="Computador" on={computador} onChange={setComputador} />
        </div>

        <div className="pt-4 border-t space-y-4">
          <h3 className="font-semibold text-gray-700 text-sm">Configurações avançadas</h3>

          <div className="space-y-2">
            <LinhaToggle
              icon={<ScanFace className="h-4 w-4 text-gray-500" />}
              label="Validação facial"
              on={facial}
              onChange={setFacial}
            />
            {!facial && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded px-2.5 py-2">
                Validação facial desligada. O colaborador usa a alternativa não-biométrica
                (CPF/PIN + foto simples, sem template biométrico) — equivalente e sem fricção,
                conforme LGPD.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-gray-600 flex items-center gap-1.5">
              ID de acesso ao quiosque
              <Hint text="Identificação do colaborador no totem compartilhado, antes do facial." />
            </span>
            <span className="font-mono text-gray-700">CPF</span>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={salvar} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar configuração
          </Button>
          {ok && <p className="text-sm text-green-600">Salvo</p>}
          {erro && <p className="text-sm text-red-600">{erro}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

function LinhaToggle({ icon, label, on, onChange }: { icon: React.ReactNode; label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm text-gray-700">{icon}{label}</span>
      <Toggle on={on} onChange={onChange} />
    </div>
  )
}

function SenhaCard({ colaboradorId }: { colaboradorId: string }) {
  const [senhaState, senhaAction, senhaPending] = useActionState(definirSenhaAction, undefined)
  return (
    <form action={senhaAction}>
      <input type="hidden" name="id" value={colaboradorId} />
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-gray-500" />
            <h2 className="font-semibold text-gray-700">Senha de acesso</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Nova senha</label>
              <Input name="senha" type="password" placeholder="mínimo 6 caracteres" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Confirmar senha</label>
              <Input name="confirmar" type="password" placeholder="repita a senha" required />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="outline" disabled={senhaPending}>
              {senhaPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
              Definir senha
            </Button>
            {senhaState?.ok && <p className="text-sm text-green-600">Senha definida</p>}
            {senhaState && !senhaState.ok && <p className="text-sm text-red-600">{senhaState.error}</p>}
          </div>
        </CardContent>
      </Card>
    </form>
  )
}

function ConviteCard({ colaborador }: { colaborador: Colaborador }) {
  const [pending, startTransition] = useTransition()
  const [ok, setOk] = useState(false)
  const [erro, setErro] = useState<string | undefined>()

  if (!colaborador.email_corporativo) return null

  function enviar() {
    startTransition(async () => {
      const r = await reenviarConviteAction(colaborador.id)
      if (r?.ok) setOk(true)
      else setErro(r?.ok === false ? r.error : 'Erro')
    })
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-gray-500" />
          <h2 className="font-semibold text-gray-700">Convite de acesso</h2>
        </div>
        <p className="text-sm text-gray-500">
          Envia email para <strong>{colaborador.email_corporativo}</strong> com link para o colaborador
          definir a própria senha e aceitar o LGPD.
        </p>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={enviar} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {colaborador.onboarding_ok ? 'Reenviar convite' : 'Enviar convite'}
          </Button>
          {ok && <p className="text-sm text-green-600">Convite enviado</p>}
          {erro && <p className="text-sm text-red-600">{erro}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

function LgpdCard({ colaborador }: { colaborador: Colaborador }) {
  const [pending, startTransition] = useTransition()
  const [ok, setOk] = useState(colaborador.onboarding_ok)
  const [erro, setErro] = useState<string | undefined>()

  function aceitar() {
    startTransition(async () => {
      const r = await aceitarLgpdAction(colaborador.id)
      if (r?.ok) setOk(true)
      else setErro(r?.ok === false ? r.error : 'Erro')
    })
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-gray-500" />
            <h2 className="font-semibold text-gray-700">Aviso de Tratamento de Dados (LGPD)</h2>
          </div>
          <Badge variant={ok ? 'success' : 'outline'}>{ok ? 'Aceito' : 'Pendente'}</Badge>
        </div>
        {!ok ? (
          <>
            <p className="text-sm text-gray-500">
              O colaborador precisa aceitar o aviso antes de registrar o ponto. Use este botão se o
              aceite foi feito presencialmente.
            </p>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={aceitar} disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Registrar aceite presencial
              </Button>
              {erro && <p className="text-sm text-red-600">{erro}</p>}
            </div>
          </>
        ) : (
          <p className="text-sm text-green-700">Aceite registrado — colaborador pode bater ponto.</p>
        )}
      </CardContent>
    </Card>
  )
}

function DesligamentoCard({ colaborador }: { colaborador: Colaborador }) {
  const hojeStr = new Date().toISOString().slice(0, 10)
  const [dataDeslig, setDataDeslig] = useState(hojeStr)
  const [pending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  function desligar() {
    if (!confirm(`Desligar ${colaborador.nome_completo} em ${dataDeslig}? Login e marcações ficarão bloqueados.`)) return
    setErro(null)
    startTransition(async () => {
      const r = await desligarAction(colaborador.id, dataDeslig)
      if (r.ok) window.location.reload()
      else setErro(r.error)
    })
  }
  function reativar() {
    if (!confirm(`Reativar ${colaborador.nome_completo}? Login será liberado.`)) return
    setErro(null)
    startTransition(async () => {
      const r = await reativarAction(colaborador.id)
      if (r.ok) window.location.reload()
      else setErro(r.error)
    })
  }

  return (
    <Card className={colaborador.ativo ? 'border-red-200' : 'border-amber-200 bg-amber-50/40'}>
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-center gap-2">
          <UserX className="h-4 w-4 text-gray-500" />
          <h2 className="font-semibold text-gray-700">{colaborador.ativo ? 'Desligamento' : 'Colaborador desligado'}</h2>
          {!colaborador.ativo && (
            <Badge variant="destructive">
              Inativo{colaborador.data_desligamento && ` desde ${colaborador.data_desligamento.slice(0, 10).split('-').reverse().join('/')}`}
            </Badge>
          )}
        </div>
        {colaborador.ativo ? (
          <>
            <p className="text-sm text-gray-600">
              Encerra o vínculo. Login é bloqueado, jornada vigente é encerrada e ele não consegue mais
              bater ponto. Use a data efetiva do desligamento.
            </p>
            <div className="flex items-end gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Data do desligamento</label>
                <Input type="date" value={dataDeslig} onChange={(e) => setDataDeslig(e.target.value)} />
              </div>
              <Button variant="destructive" onClick={desligar} disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />}
                Desligar colaborador
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              Esse colaborador está inativo. Se foi desligado por engano, é possível reativá-lo.
            </p>
            <Button variant="outline" onClick={reativar} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Reativar colaborador
            </Button>
          </>
        )}
        {erro && <p className="text-sm text-red-600">{erro}</p>}
      </CardContent>
    </Card>
  )
}
