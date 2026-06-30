import SwiftUI

struct AccountsView: View {
    @StateObject private var vm: AccountsViewModel
    private let onClose: () -> Void

    init(token: String, onClose: @escaping () -> Void) {
        _vm = StateObject(wrappedValue: AccountsViewModel(token: token))
        self.onClose = onClose
    }

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Accounts")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Done") { onClose() }
                    }
                }
        }
        .task { await vm.load() }
    }

    @ViewBuilder
    private var content: some View {
        if vm.isLoading {
            ProgressView()
        } else if vm.accounts.isEmpty {
            ContentUnavailableView(
                "No accounts",
                systemImage: "creditcard",
                description: Text(vm.error ?? "Connect a bank to see your accounts here.")
            )
        } else {
            List {
                Section {
                    ForEach(vm.accounts) { account in
                        row(account)
                    }
                } footer: {
                    Text("Only included accounts count toward your safe-to-spend. Turn off savings or credit accounts you don't spend from.")
                }

                if let error = vm.error {
                    Text(error).foregroundStyle(Theme.risk(.danger)).font(.footnote)
                }
            }
        }
    }

    private func row(_ account: Account) -> some View {
        Toggle(isOn: binding(for: account)) {
            HStack(spacing: 12) {
                Image(systemName: "building.columns.fill")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.brand)
                    .frame(width: 36, height: 36)
                    .background(
                        Theme.brand.opacity(0.12),
                        in: RoundedRectangle(cornerRadius: 10, style: .continuous)
                    )
                VStack(alignment: .leading, spacing: 2) {
                    Text(account.displayName)
                    HStack(spacing: 6) {
                        if let mask = account.mask { Text("•••• \(mask)") }
                        Text(Format.currency(account.balance))
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
            }
        }
        .disabled(vm.togglingIds.contains(account.id))
    }

    private func binding(for account: Account) -> Binding<Bool> {
        Binding(
            get: { account.includedInRunway },
            set: { newValue in Task { await vm.setIncluded(account, newValue) } }
        )
    }
}
