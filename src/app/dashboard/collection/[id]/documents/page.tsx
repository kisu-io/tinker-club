import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Vehicles, Documents } from "@/lib/repo";
import { DeleteButton } from "@/components/DeleteButton";
import { formatDate } from "@/lib/format";
import { AddDocumentButton } from "./AddDocumentButton";
import { deleteDocument } from "../detail-actions";

export default async function DocumentsPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const v = await Vehicles.forOwner(params.id, user.id);
  if (!v) notFound();

  const docs = await Documents.forVehicle(v.id);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink-500">All documents</h2>
        <AddDocumentButton vehicleId={v.id} />
      </div>

      <div className="card overflow-hidden">
        {docs.length === 0 ? (
          <p className="p-8 text-center text-sm text-ink-400">No results.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Category</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Type</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Date</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Uploaded by</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-b border-ink-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-ink-900">
                    {d.fileUrl ? (
                      <a href={d.fileUrl} target="_blank" rel="noreferrer" className="hover:underline">{d.name}</a>
                    ) : d.name}
                  </td>
                  <td className="hidden px-4 py-3 text-ink-500 sm:table-cell">{d.category}</td>
                  <td className="hidden px-4 py-3 text-ink-500 sm:table-cell">{d.type}</td>
                  <td className="hidden px-4 py-3 text-ink-500 md:table-cell">{formatDate(d.createdAt)}</td>
                  <td className="hidden px-4 py-3 text-ink-500 md:table-cell">{d.uploaderName ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <DeleteButton action={deleteDocument.bind(null, v.id, d.id)} confirm="Delete this document?" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
