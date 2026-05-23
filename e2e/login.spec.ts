import { test, expect } from '@playwright/test'

test.describe('Login page', () => {
  test('renders the brand mark and primary form', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Contraseña')).toBeVisible()
    await expect(page.getByRole('button', { name: /entrar a la consola/i })).toBeVisible()
  })

  test('shows validation when email is invalid', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('no-es-email')
    await page.getByLabel('Contraseña').fill('algunacontra')
    await page.getByRole('button', { name: /entrar a la consola/i }).click()
    await expect(page.getByText(/email inválido/i)).toBeVisible()
  })
})
