import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("./FormControls.jsx", import.meta.url), "utf8");
const { code } = await transformWithOxc(source, "FormControls.jsx", { jsx: { runtime: "automatic" } });
const resolved = code.replaceAll('"react/jsx-runtime"', JSON.stringify(pathToFileURL(require.resolve("react/jsx-runtime")).href)).replaceAll('"react"', JSON.stringify(pathToFileURL(require.resolve("react")).href));
const { Input, Select, Textarea, FormField, FormSection, FormGrid, FormActions } = await import(`data:text/javascript;base64,${Buffer.from(resolved).toString("base64")}`);

test("os controles preservam valor, máscara, ref, eventos e validação nativos", () => {
  const ref = { current: null };
  const onChange = () => {};
  const onBlur = () => {};
  for (const [Component, type] of [[Input, "input"], [Select, "select"], [Textarea, "textarea"]]) {
    const props = { value: "000.123.456-78", onChange, onBlur, ref, required: true, disabled: true, readOnly: true, name: "cpf", id: "cpf", "aria-invalid": true, "aria-describedby": "cpf-error", className: "custom" };
    const element = Component(props);
    assert.equal(element.type, type);
    for (const [name, value] of Object.entries(props)) if (name !== "className") assert.equal(element.props[name], value);
    assert.match(element.props.className, /custom/);
  }
});

test("checkbox, rádio e upload preservam checked, accept e comportamento do input", () => {
  for (const type of ["checkbox", "radio", "file", "date", "number", "hidden"]) {
    const onChange = () => {};
    const element = Input({ type, checked: true, accept: ".pdf", multiple: true, min: "0", onChange });
    assert.equal(element.props.type, type);
    assert.equal(element.props.checked, true);
    assert.equal(element.props.accept, ".pdf");
    assert.equal(element.props.multiple, true);
    assert.equal(element.props.onChange, onChange);
  }
});

test("o campo associa label, indicação obrigatória e erro sem duplicar asterisco", () => {
  const children = [createElement("span", { key: "label" }, "CPF"), createElement(Input, { key: "input", id: "cpf", required: true, "aria-describedby": "cpf-error" }), createElement("small", { key: "error", id: "cpf-error" }, "CPF incompleto")];
  const field = FormField({ htmlFor: "cpf", children });
  assert.equal(field.props["data-required"], true);
  const html = renderToStaticMarkup(field);
  assert.match(html, /for="cpf"/);
  assert.match(html, /aria-describedby="cpf-error"/);
  assert.match(html, /id="cpf-error">CPF incompleto/);
  children[0] = createElement("span", { key: "label" }, "CPF *");
  assert.equal(FormField({ children }).props["data-required"], undefined);
});

test("seções, grids e ações mantêm a semântica e o envio do formulário", () => {
  const onSubmit = () => {};
  const section = FormSection({ as: "form", onSubmit, noValidate: true });
  assert.equal(section.type, "form");
  assert.equal(section.props.onSubmit, onSubmit);
  assert.equal(section.props.noValidate, true);
  assert.equal(FormGrid({}).type, "div");
  assert.equal(FormActions({}).type, "footer");
});

test("todos os módulos usam os controles globais, inclusive os carregados sob demanda", async () => {
  const files = await readdir(new URL("../../", import.meta.url), { recursive: true });
  let modules = 0;
  for (const file of files.filter((file) => /\.(jsx|tsx)$/.test(file) && !file.endsWith("FormControls.jsx"))) {
    const content = await readFile(new URL(`../../${file.replaceAll("\\", "/")}`, import.meta.url), "utf8");
    assert.doesNotMatch(content, /<(?:input|select|textarea|label)\b/, `${file} deve usar FormControls`);
    if (/<(?:Input|Select|Textarea)\b/.test(content)) modules++;
  }
  assert.ok(modules >= 14);
  const main = await readFile(new URL("../../main.jsx", import.meta.url), "utf8");
  assert.match(main, /import ['"]\.\/formDesignSystem\.css['"]/);
});
