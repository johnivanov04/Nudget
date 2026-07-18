import SwiftUI
import LinkKit

/// Presents Plaid Link for a given link token. `onSuccess` returns the public
/// token (to exchange server-side); `onExit` returns an error message, or nil if
/// the user simply cancelled.
struct PlaidLinkView: UIViewControllerRepresentable {
    let linkToken: String
    let onSuccess: (String) -> Void
    let onExit: (String?) -> Void

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIViewController(context: Context) -> UIViewController {
        let hosting = UIViewController()
        hosting.view.backgroundColor = .systemBackground

        var configuration = LinkTokenConfiguration(token: linkToken) { success in
            onSuccess(success.publicToken)
        }
        configuration.onExit = { exit in
            guard let error = exit.error else {
                onExit(nil) // user simply cancelled
                return
            }
            let status = exit.metadata.status.map { String(describing: $0) } ?? "—"
            let detail = "\(String(describing: error.errorCode)) · \(error.errorMessage)"
            print("[PlaidLink] EXIT ERROR:", detail,
                  "| display:", error.displayMessage ?? "-",
                  "| status:", status)
            onExit(detail)
        }

        switch Plaid.create(configuration) {
        case .failure(let error):
            let detail = "create failed: \(String(describing: error))"
            print("[PlaidLink]", detail)
            DispatchQueue.main.async { onExit(detail) }
        case .success(let handler):
            context.coordinator.handler = handler
            DispatchQueue.main.async {
                handler.open(presentUsing: .viewController(hosting))
            }
        }
        return hosting
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}

    final class Coordinator {
        var handler: Handler?
    }
}
