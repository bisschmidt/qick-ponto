# Roteiro de Teste — Módulo Hora Extra (HE)

Roteiro de teste **manual** (funcional, pela interface) do módulo de Hora Extra.
Cobre as três origens de HE: planejada (gestor), de compensação (colaborador) e
espontânea/não planejada (M4).

## Pré-requisitos (montar antes de começar)

| Item | Por quê |
|------|---------|
| 1 conta **Admin** (ou RH/DP) | configurar limites de HE |
| 1 conta **Gestor** | lançar e aprovar HE |
| 1 conta **Colaborador** (no time do gestor) | aceitar, bater ponto, solicitar compensação |
| O colaborador precisa ter uma **escala/jornada definida** | o sistema valida a HE contra o turno normal |

> Faça os testes com o colaborador num **dia de escala** (ex.: jornada 08:00–17:00)
> para validar os bloqueios de turno.

---

## Cenário 0 — Configuração dos limites (Admin)

1. Login como **Admin** → menu **Administração** (`/dashboard/admin`)
2. Localize o formulário de **Configuração de HE**
3. Confirme/defina os limites. Se nunca configurado, o sistema usa estes **padrões**:
   - Máx. por dia: **2h** · por semana: **10h** · por mês: **40h** · intervalo mínimo após jornada: **60 min**
4. Salve

**Esperado:** valores salvos e refletidos ao reabrir a tela.

---

## Cenário 1 — HE Planejada, caminho feliz (REMUNERADA)

### A) Gestor lança
1. Login como **Gestor** → menu **Horas Extras** (`/dashboard/he`)
2. Botão **"Lançar HE"** → preencha: colaborador, data, hora início/fim **em turno diferente**
   da jornada (ex.: jornada 08–17 → HE das **18:30 às 20:30**), tipo **Remunerada**
3. Salvar

**Esperado:** a HE aparece na aba **"Aguardando aceite"**.

### B) Colaborador aceita
1. Login como **Colaborador** → tela de ponto → aba **"Horas Extras"** (`/ponto/compensacao`)
2. Veja a HE pendente → **Aceitar**

**Esperado:** sai de "Aguardando aceite" e passa para **"A marcar"** (visível pro gestor).

### C) Colaborador bate o ponto da HE (no dia)
1. Colaborador → tela de **bater ponto** (`/ponto`) → deve aparecer o botão roxo **"Bater Hora Extra"**
2. Bata a **entrada** da HE → depois a **saída**

**Esperado:**
- HE vira **"Realizadas"**
- A marcação ganha **lastro fiscal real** (NSR/AFD), igual a um ponto normal
- Os minutos entram como **HE 50%** na apuração do dia → o M8/folha exporta automaticamente

---

## Cenário 2 — Validações / bloqueios (Gestor lançando)

Tente lançar HE em cada situação e confirme a mensagem de erro:

| Teste | Como provocar | Mensagem esperada |
|-------|---------------|-------------------|
| **Turno sobreposto** | HE das 16:00–18:00 com jornada 08–17 | *"A HE deve ser em turno diferente da jornada normal do colaborador"* |
| **Intervalo curto** | jornada termina 17:00, HE começa 17:30 (gap 30 min) | *"Intervalo mínimo entre jornada e HE é de 60 min (atual: 30 min)"* |
| **Teto diário** | lançar HE somando **> 2h** no mesmo dia de escala | *"Limite diário de HE excedido (2h)…"* |
| **Fim antes do início** | hora fim ≤ hora início | *"Horário de fim deve ser após o início"* |
| **Exceção sábado** | HE de **3h num sábado fora da escala** | **Deve PERMITIR** (teto diário não vale fora da escala; semanal/mensal continuam valendo) |

**Recusa pelo colaborador:**
- Gestor lança → Colaborador abre `/ponto/compensacao` → **Recusar**
- **Esperado:** HE vira **Recusada** e não vira ponto a marcar.

---

## Cenário 3 — HE de Compensação (colaborador antecipa para abonar falta)

### A) Colaborador solicita
1. Colaborador → `/ponto/compensacao` → **"Solicitar compensação"**
2. Informe a **data da falta** (futura) + **dias/horários** que vai trabalhar a mais para compensar
3. Enviar

**Esperado:** vai para a aba **"Compensações"** do gestor, status **pendente**.

### B) Gestor decide
1. Gestor → `/dashboard/he` → aba **"Compensações"**
2. Teste as 3 ações: **Aprovar**, **Alterar dias** (muda os dias propostos) e **Reprovar**

**Esperado:** ao **Aprovar**, os dias viram HE "a marcar" para o colaborador bater.

### C) Colaborador bate os dias de compensação
Igual ao Cenário 1-C (botão **"Bater Hora Extra"**).

### D) Reconciliação — na data da falta (ponto-chave do módulo)
Chegando o dia da falta, o sistema concilia o que foi compensado:

| Situação | Resultado esperado |
|----------|--------------------|
| Compensou **≥** a jornada do dia | Dia da falta vira **Compensado** (sem desconto) |
| Compensou **parte** | Parte não coberta vira **Falta** |
| **Não** compensou | **Falta** normal |

---

## Cenário 4 — Falta HE (não bateu o ponto da HE)

1. Lance/aceite uma HE e **não bata** o ponto até passar o horário
2. Gestor → `/dashboard/he` → aba **"Falta HE"**

**Esperado:** a HE aparece em "Falta HE" (é só registro de controle — **não** gera alerta nem punição automática).

---

## Cenário 5 — HE não planejada (regressão — não deve ter mudado)

1. Colaborador bate ponto **além da jornada normal** (sem nenhuma HE lançada)
2. Rode a apuração do dia (M4)

**Esperado:** o sistema calcula a HE **automaticamente** como sempre fez. Este módulo
**não** alterou esse caminho — é só conferir que continua funcionando.

---

## Checklist rápido de cobertura

- [ ] Config de limites salva (Admin)
- [ ] HE planejada: lançar → aceitar → bater → Realizada → entra na folha
- [ ] 4 bloqueios de validação + exceção de sábado
- [ ] Recusa pelo colaborador
- [ ] Compensação: solicitar → aprovar/alterar/reprovar → bater → reconciliar (3 resultados)
- [ ] Falta HE aparece na aba
- [ ] HE espontânea (M4) continua funcionando
