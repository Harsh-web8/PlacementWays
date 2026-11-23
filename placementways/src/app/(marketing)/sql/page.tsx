import { SqlLab } from "@/components/sql/sql-lab";
export const metadata={title:"Free SQL practice | PlacementWays",description:"Practice SQL SELECT queries for placement tests without login."};
export default function SqlPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-7 px-4 py-10 sm:px-6">
      <div>
        <h1 className="font-serif text-4xl">SQL Practice Lab</h1>
        <p className="mt-2 max-w-2xl text-slate-700">Free, no-login guided SQL exercises with sample employee data and instant output checking.</p>
        <p className="mt-2 text-sm text-amber-800">Practice SELECT, WHERE, IN, AND, DISTINCT, GROUP BY, COUNT, AVG, ORDER BY and LIMIT.</p>
      </div>
      <SqlLab />
    </div>
  );
}
