# ZEUS Team — Shared Context

**Обновляется каждую сессию. Все агенты читают это.**

---

## Кто мы и что строим

v0Laura — AI-powered skill platform. НЕ просто assessment tool.
Архитектура: 1 платформа + skill library. Каждый скилл = отдельная способность.
MindShift = один скилл. Life Simulator = другой. ZEUS agents = живые персонажи в мире.

**Главная идея:** агенты — не бэкенд. Агенты — это интерфейс который пользователь видит и с которым живёт.

---

## Проекты в экосистеме

| Проект | Что делает | Статус |
|--------|-----------|--------|
| MindShift | ADHD productivity PWA (React + Supabase) | Prod ready, pending Google Play |
| VOLAURA | Verified competency platform (Next.js + FastAPI) | Активна разработка |
| claw3d (ZEUS office) | 3D офис агентов | Задеплоен на Railway |
| v0Laura | Платформа всего вышеперечисленного | Архитектурная идея |

---

## Последняя сессия (2026-04-06)

**Что сделано:**
- Все 39 агентов получили новый характер — больше не боты, говорят прямо
- Убраны `<think>` теги от deepseek-r1 (visibleContent() фильтр)
- Reasoning агенты переведены на llama-3.3-70b — теперь отвечают по-русски
- 3D офис задеплоен: https://modest-happiness-production.up.railway.app
- Добавлен язык-правило: отвечаешь на том языке на котором пишут тебе

**Что не сделано ещё:**
- ZEUS coordinator (агенты изолированы, не координируются)
- RemoteAgentChatPanel — ответы не отражаются в облаке
- Shared context между агентами (вот этот файл — первый шаг)
- Life Sim / аватары / персонажи в 3D

---

## Стек

- ZEUS gateway: `server/zeus-gateway-adapter.js`, порт 18789, WebSocket
- Модели: llama-3.3-70b (fast), qwen3:8b (local/Ollama)
- Railway: https://modest-happiness-production.up.railway.app
- pm2: `zeus-gateway` процесс
- STUDIO_ACCESS_TOKEN нужен для доступа к офису

---

## Правила команды

1. Отвечай на том языке на котором пишут — русский вопрос → русский ответ
2. Мнение вперёд, оговорки потом
3. "Не знаю" лучше чем выдуманный ответ
4. Нет корпоративным шаблонам ("Great question!", "How can I assist?")
5. Если нужен файл которого нет — скажи какой и почему

---

## CEO / CTO

**CEO:** Юсиф Ганбаров (ganbarov.y@gmail.com) — стратегия, видение, финальные решения
**CTO (текущая сессия):** Claude — исполнение, технические решения, управление командой

CEO не даёт мелких задач. Если CEO молчит — команда работает автономно.
