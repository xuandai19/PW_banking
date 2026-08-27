# Backend - Banking Management System

## Run

```bash
npm install
copy .env.example .env
npm run db:init
npm run dev
```

## API

- `/api/auth`
- `/api/banks`
- `/api/branches`
- `/api/accounts`
- `/api/transactions`
- `/api/approvals`
- `/api/dashboard`
- `/api/health`

Authentication uses signed JWT. Passwords use Node.js `scrypt`. Deposit, withdrawal and transfer update account balances and transaction history inside one MySQL transaction with rollback on failure.
