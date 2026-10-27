// RNF-22: mensagem de commit no Conventional Commits, em português
// (ex.: `feat(custeio): adiciona cálculo de custo`). Conferida no hook
// `commit-msg` (.githooks) e de novo no CI, para o commit que chega sem hook.
const config = {
  extends: ['@commitlint/config-conventional'],
};

export default config;
