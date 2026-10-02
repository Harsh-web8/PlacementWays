"use client";
import { useActionState } from "react";
import { uploadLessonResource } from "@/server/admin/learning/resources";
import { initialFormState } from "@/lib/form-state";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
export function ResourceUpload({lessonId}:{lessonId:string}){
 const [state,action]=useActionState(uploadLessonResource.bind(null,lessonId),initialFormState);
 return <form action={action} className="space-y-4 rounded border p-5"><h2 className="font-serif text-2xl">Private lesson PDF</h2><p>Downloads follow the lesson’s access rules. Replacing this resource removes the previous file.</p><label className="block">PDF (up to 10 MB)<input type="file" name="file" accept="application/pdf" required className="mt-2 block"/></label>{state.message&&<Alert variant={state.status==="error"?"error":"success"}>{state.message}</Alert>}<SubmitButton>Upload private resource</SubmitButton></form>;
}
