import { PracticeCatalog } from "@/components/practice/catalog";
export const metadata={title:"Practice questions"};
export default function Page({searchParams}:PageProps<"/practice">) {return <PracticeCatalog searchParams={searchParams}/>;}
