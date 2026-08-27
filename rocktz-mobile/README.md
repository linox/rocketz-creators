# App dos criadores (Flutter)

iOS + Android. Papel **creator** apenas. API Laravel Sanctum — mesmo contrato do web.

## Setup

```bash
cd rocktz-mobile
flutter pub get
flutter run
```

Debug aponta para `http://127.0.0.1:8000/api` (iOS Simulator) ou `http://10.0.2.2:8000/api` (emulador Android). Release usa `https://api.creatorz.digital/api`. Override: `--dart-define=API_URL=https://...`.

## Tipografia

Fonte padrão: **Nunito** (Google Fonts) — geometria redonda, boa leitura em botões, formulários e contratos.

## Telas (MVP)

Login, cadastro, 2FA, home, oportunidades, trabalhos (campanhas + recorrência), entregas com upload chunked, notificações, media kit (bio/PIX), contrato, idioma PT/EN/ES.

Mapa tela → endpoint: [`rocktz-docs/09-app-criadores.md`](../rocktz-docs/09-app-criadores.md).

## Push (FCM / APNs)

Depois do login, chame `AuthSession.registerDeviceToken(fcmToken, platform)` (`ios` | `android`).

A API grava em `POST /api/device-tokens`. Envio usa FCM HTTP v1 (`FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` no `.env` da API). iOS recebe via APNs através do FCM.

Para ligar o Firebase no App: adicione `google-services.json` / `GoogleService-Info.plist` e `firebase_messaging`. Sem esses arquivos o App continua funcional (inbox in-app + polling de `GET /nav`).
