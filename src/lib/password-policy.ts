export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordRule = {
  id: string;
  label: string;
  valid: boolean;
};

export function getPasswordRules(password: string): PasswordRule[] {
  return [
    {
      id: "length-min",
      label: `Minimo de ${PASSWORD_MIN_LENGTH} caracteres`,
      valid: password.length >= PASSWORD_MIN_LENGTH,
    },
    {
      id: "length-max",
      label: `Maximo de ${PASSWORD_MAX_LENGTH} caracteres`,
      valid: password.length <= PASSWORD_MAX_LENGTH,
    },
    {
      id: "lower",
      label: "Pelo menos 1 letra minuscula",
      valid: /[a-z]/.test(password),
    },
    {
      id: "upper",
      label: "Pelo menos 1 letra maiuscula",
      valid: /[A-Z]/.test(password),
    },
    {
      id: "number",
      label: "Pelo menos 1 numero",
      valid: /\d/.test(password),
    },
    {
      id: "symbol",
      label: "Pelo menos 1 simbolo (!@#$...)",
      valid: /[^A-Za-z0-9]/.test(password),
    },
    {
      id: "spaces",
      label: "Sem espacos em branco",
      valid: !/\s/.test(password),
    },
  ];
}

export function validatePasswordPolicy(password: string) {
  const rules = getPasswordRules(password);
  const errors = rules.filter((rule) => !rule.valid).map((rule) => rule.label);
  return {
    valid: errors.length === 0,
    errors,
  };
}
