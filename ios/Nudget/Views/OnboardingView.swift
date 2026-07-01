import SwiftUI

struct OnboardingView: View {
    @StateObject private var vm: OnboardingViewModel

    init(token: String, onComplete: @escaping () -> Void) {
        _vm = StateObject(wrappedValue: OnboardingViewModel(token: token, onComplete: onComplete))
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                switch vm.step {
                case .privacy: privacyStep
                case .payday: paydayStep
                case .connectBank: connectBankStep
                }

                if let error = vm.error {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(Theme.risk(.danger))
                        .multilineTextAlignment(.center)
                }
            }
            .padding(24)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(AmbientBackground())
            .navigationTitle("Set up Nudget")
            .navigationBarTitleDisplayMode(.inline)
        }
        .task { await vm.start() }
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

    // MARK: - Steps

    private var privacyStep: some View {
        VStack(spacing: 24) {
            Spacer()
            BrandMark(systemName: "lock.shield.fill")
            VStack(spacing: 8) {
                Text("Your data, handled with care")
                    .font(.title2.weight(.bold))
                    .multilineTextAlignment(.center)
                Text("A quick look at how Nudget treats your information.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            VStack(alignment: .leading, spacing: 16) {
                bullet("Nudget never stores your bank login.")
                bullet("We use Plaid to read balances and recent transactions.")
                bullet("Disconnect your bank or delete your account anytime.")
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .card()
            Spacer()
            primaryButton("I agree & continue") { await vm.acceptPrivacy() }
        }
    }

    private var paydayStep: some View {
        VStack(alignment: .leading, spacing: 24) {
            Spacer()
            VStack(alignment: .leading, spacing: 8) {
                Text("When do you get paid?")
                    .font(.title2.weight(.bold))
                Text("This sets the runway window — today through your next payday.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            VStack(spacing: 0) {
                HStack {
                    Text("How often")
                    Spacer()
                    Picker("How often", selection: $vm.frequency) {
                        ForEach(PaydayFrequency.allCases) { Text($0.label).tag($0) }
                    }
                    .labelsHidden()
                    .pickerStyle(.menu)
                }
                Divider().padding(.vertical, 14)
                DatePicker(
                    "Last payday",
                    selection: $vm.lastPaycheckDate,
                    in: ...Date(),
                    displayedComponents: .date
                )
            }
            .card()

            Spacer()
            primaryButton("Continue") { await vm.savePayday() }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var connectBankStep: some View {
        VStack(spacing: 24) {
            Spacer()
            BrandMark(systemName: "building.columns.fill")
            VStack(spacing: 8) {
                Text("Connect your bank")
                    .font(.title2.weight(.bold))
                    .multilineTextAlignment(.center)
                Text("Securely link an account through Plaid so Nudget can calculate your runway. Nudget never sees your bank login.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            Spacer()
            primaryButton("Connect a bank") { await vm.beginLink() }
            Button("Skip for now") { vm.skip() }
                .font(.subheadline)
        }
    }

    // MARK: - Helpers

    private func bullet(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(Theme.risk(.safe))
            Text(text)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func primaryButton(_ title: String, action: @escaping () async -> Void) -> some View {
        Button {
            Task { await action() }
        } label: {
            if vm.isWorking {
                ProgressView().tint(.white).frame(maxWidth: .infinity)
            } else {
                Text(title).fontWeight(.semibold).frame(maxWidth: .infinity)
            }
        }
        .buttonStyle(.borderedProminent)
        .controlSize(.large)
        .disabled(vm.isWorking)
    }
}
