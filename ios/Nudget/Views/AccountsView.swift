import SwiftUI

struct AccountsView: View {
    @StateObject private var vm: AccountsViewModel
    private let onClose: () -> Void
    @State private var bankToDisconnect: LinkedBank?

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
        .fullScreenCover(
            isPresented: Binding(
                get: { vm.linkToken != nil },
                set: { if !$0 { vm.linkToken = nil } }
            )
        ) {
            if let linkToken = vm.linkToken {
                PlaidLinkView(
                    linkToken: linkToken,
                    onSuccess: { publicToken in
                        Task { await vm.linkSucceeded(publicToken: publicToken) }
                    },
                    onExit: { message in vm.linkExited(error: message) }
                )
                .ignoresSafeArea()
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        if vm.isLoading {
            ProgressView()
        } else if vm.accounts.isEmpty && vm.banks.isEmpty {
            ContentUnavailableView {
                Label("No accounts", systemImage: "creditcard")
            } description: {
                Text(vm.error ?? "Connect a bank to see your accounts here.")
            } actions: {
                connectBankButton("Connect a bank")
                    .buttonStyle(.borderedProminent)
            }
        } else {
            List {
                Section {
                    connectBankButton("Connect another bank")
                }

                if !vm.accounts.isEmpty {
                    Section {
                        ForEach(vm.accounts) { account in
                            row(account)
                        }
                    } footer: {
                        Text("Only included accounts count toward your safe-to-spend. Turn off savings or credit accounts you don't spend from.")
                    }
                }

                if !vm.banks.isEmpty {
                    Section {
                        ForEach(vm.banks) { bank in
                            bankRow(bank)
                        }
                    } header: {
                        Text("Linked banks")
                    } footer: {
                        Text("Disconnecting a bank removes its accounts and transactions from Nudget. You can reconnect it later.")
                    }
                }

                if let error = vm.error {
                    Text(error).foregroundStyle(Theme.risk(.danger)).font(.footnote)
                }
            }
            .confirmationDialog(
                "Disconnect \(bankToDisconnect?.displayName ?? "bank")?",
                isPresented: Binding(
                    get: { bankToDisconnect != nil },
                    set: { if !$0 { bankToDisconnect = nil } }
                ),
                titleVisibility: .visible,
                presenting: bankToDisconnect
            ) { bank in
                Button("Disconnect", role: .destructive) {
                    Task { await vm.disconnect(bank) }
                }
                Button("Cancel", role: .cancel) {}
            } message: { bank in
                Text("This removes \(bank.displayName)'s accounts and transactions from Nudget.")
            }
        }
    }

    private func connectBankButton(_ title: String) -> some View {
        Button {
            Task { await vm.beginAddBank() }
        } label: {
            if vm.isLinking {
                ProgressView().frame(maxWidth: .infinity)
            } else {
                Label(title, systemImage: "plus.circle.fill")
            }
        }
        .disabled(vm.isLinking)
    }

    private func bankRow(_ bank: LinkedBank) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "building.columns.fill")
                .foregroundStyle(Theme.brand)
            Text(bank.displayName)
            Spacer()
            if vm.disconnectingIds.contains(bank.id) {
                ProgressView()
            } else {
                Button("Disconnect", role: .destructive) {
                    bankToDisconnect = bank
                }
                .font(.subheadline)
                .buttonStyle(.borderless)
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
