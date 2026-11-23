import "server-only";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
const totals={total:z.number().int().nonnegative(),correct:z.number().int().nonnegative()};
export const analyticsSchema=z.object({
 topics:z.array(z.object({category_id:z.uuid(),name:z.string(),parent_id:z.uuid().nullable(),...totals})),
 subjects:z.array(z.object({id:z.uuid(),name:z.string(),...totals})),
 difficulties:z.array(z.object({difficulty:z.string(),...totals})),
 companies:z.array(z.object({id:z.uuid(),name:z.string(),attempts:z.number(),percentage:z.number().nullable()})),
 recommendations:z.array(z.object({category_id:z.uuid(),topic:z.string(),lessons:z.array(z.object({id:z.uuid(),title:z.string(),course_slug:z.string()})),mocks:z.array(z.object({slug:z.string(),title:z.string()}))})),
 history:z.array(z.object({id:z.uuid(),started_at:z.string(),score:z.number(),total_marks:z.number(),status:z.string(),title:z.string(),slug:z.string(),percentage:z.number().nullable()})),
});
export async function getLearningAnalytics(){const db=await createClient();const {data,error}=await db.rpc("get_learning_analytics");if(error)throw new Error("Could not load your analytics.");return analyticsSchema.parse(data);}
