import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { FormField, PasswordField, TextareaField, SelectField } from "@/components/ui/form-field";

type CommonProps = {name:string;label:string;hint:string;errors:string[];className:string;"aria-invalid":false;"aria-describedby":string};
for (const [name, Field] of Object.entries({FormField,PasswordField,TextareaField,SelectField})) {
  it(`${name} keeps errors and hints connected despite conflicting caller attributes`,()=>{
    const html=renderToStaticMarkup(createElement("div", null, createElement("p", {id:"external-help"}, "Additional help"), createElement(Field as ComponentType<CommonProps>,{
      name:"fixture",label:"Fixture field",hint:"Helpful hint",errors:["Required value"],
      className:"text-red-500 pr-0","aria-invalid":false,"aria-describedby":"external-help",
    })));
    const control=html.match(/<(input|textarea|select)\b[^>]*>/)?.[0] ?? "";
    expect(control).toContain('aria-invalid="true"');
    expect(control).toContain("external-help");
    const ids=control.match(/aria-describedby="([^"]+)"/)?.[1].split(" ") ?? [];
    expect(ids).toHaveLength(3);
    for(const id of ids) expect(html).toContain(`id="${id}"`);
    expect(control).toContain("text-red-500");
    if(name==='PasswordField') {
      expect(control).toContain("pr-11");
      expect(control).not.toContain("pr-0");
    }
  });
}
