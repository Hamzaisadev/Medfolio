import { useSearchParams } from 'react-router-dom';

/**
 * Landing page for the integrity stamp printed on exported documents.
 *
 * It confirms the stamp's provenance and shows what to compare against; it
 * deliberately does not claim to have verified the document's contents, because
 * the checksum is computed over a payload this page does not have.
 */
export function ShareVerifyPage() {
  const [params] = useSearchParams();
  const documentId = params.get('doc');
  const hash = params.get('hash');

  const isWellFormed = Boolean(documentId) && /^[0-9A-F]{12}$/.test(hash ?? '');

  return (
    <div className="min-h-screen bg-ink-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-ink-200 shadow-sm space-y-5">
        <div className="space-y-1.5 text-center">
          <h1 className="text-lg font-bold text-ink-900">Document Integrity Check</h1>
          <p className="text-xs text-ink-600 leading-relaxed">
            Every Medfolio export carries a SHA-256 stamp so you can tell whether two copies of a
            document are identical.
          </p>
        </div>

        {isWellFormed ? (
          <div className="space-y-3">
            <dl className="text-xs space-y-2">
              <div className="flex justify-between gap-4 border-b border-ink-100 pb-2">
                <dt className="font-semibold text-ink-700">Document</dt>
                <dd className="font-mono text-ink-900 break-all text-right">{documentId}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-semibold text-ink-700">Stamp</dt>
                <dd className="font-mono text-ink-900">MED-{hash}</dd>
              </div>
            </dl>

            <div className="rounded-lg bg-ink-50 border border-ink-200 p-3 text-[11px] text-ink-600 leading-relaxed">
              This link is well-formed. Compare the stamp above with the one printed on the document
              you received — if they differ, the document was not produced by this export.
            </div>

            <p className="text-[11px] text-ink-400 leading-relaxed">
              A matching stamp confirms the document matches this export record. It is not a medical
              or legal certification of the record's contents.
            </p>
          </div>
        ) : (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 leading-relaxed">
            This verification link is incomplete or malformed. Open the exact link printed on the
            document, or ask the patient to re-export it from Medfolio.
          </div>
        )}
      </div>
    </div>
  );
}
