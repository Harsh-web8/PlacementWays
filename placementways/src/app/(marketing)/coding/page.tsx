import { PracticeCatalog } from "@/components/practice/catalog";
export const metadata={title:"Coding practice"};
export default function Page({searchParams}:PageProps<"/coding">) {return <PracticeCatalog coding searchParams={searchParams}/>;}
