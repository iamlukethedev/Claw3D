# CTO Kanban — ZEUS / MindShift / v0Laura
*Обновляется каждую сессию. Читать перед началом работы.*

---

## 🔴 БЛОКЕРЫ (сделать до всего)

| # | Задача | Кто | Дата |
|---|--------|-----|------|
| — | пока чисто | — | — |

---

## 🟡 В РАБОТЕ

| # | Задача | Статус |
|---|--------|--------|
| Z-02 | RemoteAgentChatPanel — ответы не отражаются в облаке | Не начато |

---

## 🟢 BACKLOG

| # | Задача | Приоритет |
|---|--------|-----------|
| Z-03 | Life Sim / аватары — Ready Player Me в claw3d | P1 |
| Z-04 | ZEUS gateway → Railway (агенты в облаке) | P1 |
| Z-05 | Agent memory per-session — агент помнит предыдущие разговоры | P2 |
| Z-06 | Coordinator автономный режим (пока Юсиф на работе) | P2 |
| Z-07 | VOLAURA MindShift integration через REST API | P3 |
| M-01 | MindShift → Google Play (ждёт верификации аккаунта) | P1 |
| M-02 | Phase 3 If-Then Intentions | P2 |

---

## ✅ СДЕЛАНО (эта сессия)

| Задача | Дата |
|--------|------|
| 39 агентов получили характер (новый buildSystemPrompt) | 2026-04-06 |
| `<think>` теги убраны (visibleContent filter) | 2026-04-06 |
| Reasoning агенты → llama-3.3-70b (русский язык) | 2026-04-06 |
| 3D офис задеплоен на Railway | 2026-04-06 |
| Shared context для всех агентов (session-context.md) | 2026-04-06 |
| PORT fix для Railway (zeus-gateway-adapter.js) | 2026-04-06 |
| next.config.ts → .mjs (production fix) | 2026-04-06 |
| /health endpoint bypass для Railway healthcheck | 2026-04-06 |
| **Z-01: swarm.run coordinator** — параллельный запуск + синтез (Nemotron 253B) | 2026-04-06 |
| test-swarm.js — CLI тест координатора, протокол connect→swarm.run | 2026-04-06 |

---

## 📋 ЧЕКЛИСТ НАЧАЛА СЕССИИ

- [ ] Прочитать этот файл
- [ ] Прочитать session-context.md
- [ ] Проверить: есть ли блокеры от прошлой сессии?
- [ ] Спросить себя: кто из команды может это сделать? (не делать сам)
- [ ] Запустить агентов параллельно, не последовательно

---

## 📊 МЕТРИКИ КОМАНДЫ

| Агент | Последний запуск | Находок | Статус |
|-------|-----------------|---------|--------|
| security-agent | 2026-04-06 | swarm.run тест | llama-3.3-70b ✅ |
| architecture-agent | 2026-04-06 | swarm.run тест | llama-3.3-70b ✅ |
| product-agent | 2026-04-06 | swarm.run тест | llama-3.3-70b ✅ |
| Остальные 36 | Никогда | 0 | Не тестированы |
