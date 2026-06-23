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
            onExit(exit.error?.localizedDescription)
        }

        switch Plaid.create(configuration) {
        case .failure(let error):
            DispatchQueue.main.async { onExit(error.localizedDescription) }
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
