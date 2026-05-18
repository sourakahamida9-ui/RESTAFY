import { describe, it, expect } from 'vitest';
import {
  validateRegistrationInput,
  normalizeRegistrationInput,
  interpretSupabaseAuthError,
  generateRestaurantSlug,
  isPhoneConflict,
  validateSignupFields,
  EMAIL_REGEX,
  SIGNUP_MIN_PASSWORD_LENGTH,
} from './register-confirmed';

describe('register-confirmed validation', () => {
  describe('validateRegistrationInput', () => {
    it('devrait valider des données d\'inscription valides', () => {
      const result = validateRegistrationInput({
        email: 'test@example.com',
        password: 'Password123',
        fullName: 'John Doe',
        phone: '1234567890',
        role: 'client',
      });
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('devrait rejeter un email manquant', () => {
      const result = validateRegistrationInput({
        email: '',
        password: 'Password123',
        fullName: 'John Doe',
        phone: '1234567890',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('E-mail et mot de passe requis');
    });

    it('devrait rejeter un mot de passe trop court', () => {
      const result = validateRegistrationInput({
        email: 'test@example.com',
        password: 'Short1',
        fullName: 'John Doe',
        phone: '1234567890',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Mot de passe trop faible');
    });

    it('devrait rejeter un mot de passe sans chiffre', () => {
      const result = validateRegistrationInput({
        email: 'test@example.com',
        password: 'Password',
        fullName: 'John Doe',
        phone: '1234567890',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Mot de passe trop faible');
    });

    it('devrait rejeter un nom de restaurant manquant pour restaurant_owner', () => {
      const result = validateRegistrationInput({
        email: 'test@example.com',
        password: 'Password123',
        fullName: 'John Doe',
        phone: '1234567890',
        role: 'restaurant_owner',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Le nom du restaurant est requis pour un compte partenaire');
    });
  });

  describe('validateSignupFields', () => {
    it('devrait valider des données d\'inscription valides', () => {
      const result = validateSignupFields({
        email: 'test@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
        fullName: 'John Doe',
        phone: '1234567890',
      });
      expect(result).toBeNull();
    });

    it('devrait rejeter des mots de passe différents', () => {
      const result = validateSignupFields({
        email: 'test@example.com',
        password: 'Password123',
        confirmPassword: 'Different123',
        fullName: 'John Doe',
        phone: '1234567890',
      });
      expect(result).toBe('Les mots de passe ne correspondent pas.');
    });

    it('devrait rejeter un email invalide', () => {
      const result = validateSignupFields({
        email: 'invalid-email',
        password: 'Password123',
        confirmPassword: 'Password123',
        fullName: 'John Doe',
        phone: '1234567890',
      });
      expect(result).toBe('Format d\'e-mail invalide.');
    });
  });

  describe('normalizeRegistrationInput', () => {
    it('devrait normaliser les données d\'inscription', () => {
      const result = normalizeRegistrationInput({
        email: '  TEST@EXAMPLE.COM  ',
        password: 'Password123',
        fullName: '  John Doe  ',
        phone: '  1234567890  ',
        role: 'RESTAURANT_OWNER',
        restaurantName: '  My Restaurant  ',
      });

      expect(result.email).toBe('test@example.com');
      expect(result.fullName).toBe('John Doe');
      expect(result.phone).toBe('1234567890');
      expect(result.role).toBe('restaurant_owner');
      expect(result.restaurantName).toBe('My Restaurant');
    });
  });

  describe('interpretSupabaseAuthError', () => {
    it('devrait interpréter une erreur d\'email déjà utilisé', () => {
      const result = interpretSupabaseAuthError({
        message: 'User already registered',
      });
      expect(result.statusCode).toBe(409);
      expect(result.message).toContain('déjà utilisée');
    });

    it('devrait interpréter une erreur de mot de passe faible', () => {
      const result = interpretSupabaseAuthError({
        message: 'Password should be at least 8 characters',
      });
      expect(result.statusCode).toBe(400);
      expect(result.message).toContain('Mot de passe refusé');
    });
  });

  describe('generateRestaurantSlug', () => {
    it('devrait générer un slug unique', () => {
      const slug = generateRestaurantSlug('Mon Restaurant');
      expect(slug).toMatch(/mon-restaurant-[a-z0-9]+/);
    });

    it('devrait normaliser les accents', () => {
      const slug = generateRestaurantSlug('Café de Paris');
      expect(slug).toMatch(/cafe-de-paris-[a-z0-9]+/);
    });
  });

  describe('isPhoneConflict', () => {
    it('devrait détecter un conflit de téléphone par code', () => {
      const result = isPhoneConflict({ code: '23505' });
      expect(result).toBe(true);
    });

    it('devrait détecter un conflit de téléphone par message', () => {
      const result = isPhoneConflict({ message: 'Duplicate key value violates unique constraint "profiles_phone_key"' });
      expect(result).toBe(true);
    });

    it('devrait retourner false pour d\'autres erreurs', () => {
      const result = isPhoneConflict({ code: '23503' });
      expect(result).toBe(false);
    });
  });

  describe('EMAIL_REGEX', () => {
    it('devrait valider un email correct', () => {
      expect(EMAIL_REGEX.test('test@example.com')).toBe(true);
      expect(EMAIL_REGEX.test('user.name+tag@domain.co.uk')).toBe(true);
    });

    it('devrait rejeter un email incorrect', () => {
      expect(EMAIL_REGEX.test('invalid')).toBe(false);
      expect(EMAIL_REGEX.test('@example.com')).toBe(false);
      expect(EMAIL_REGEX.test('test@')).toBe(false);
    });
  });

  describe('SIGNUP_MIN_PASSWORD_LENGTH', () => {
    it('devrait être défini à 8', () => {
      expect(SIGNUP_MIN_PASSWORD_LENGTH).toBe(8);
    });
  });
});
