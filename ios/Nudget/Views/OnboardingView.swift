import SwiftUI

struct OnboardingView: View {
    @StateObject private var vm: OnboardingViewModel
    private let onComplete: () -> Void

    init(token: String, onComplete: @escaping () -> Void) {
        _vm = StateObject(wrappedValue: OnboardingViewModel(token: token))
        self.onComplete = onComplete
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
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                }
            }
            .padding(24)
            .navigationTitle("Set up Nudget")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    // MARK: - Steps

    private var privacyStep: some View {
        VStack(spacing: 20) {
            Spacer()
            Image(systemName: "lock.shield")
                .font(.system(size: 56))
                .foregroundStyle(.tint)
            Text("Your data, handled with care")
                .font(.title2.weight(.bold))
                .multilineTextAlignment(.center)
            VStack(alignment: .leading, spacing: 12) {
                bullet("Nudget never stores your bank login.")
                bullet("We use Plaid to read balances and recent transactions.")
                bullet("You can disconnect your bank or delete your account anytime.")
            }
            Spacer()
            primaryButton("I agree & continue") { await vm.acceptPrivacy() }
        }
    }

    private var paydayStep: some View {
        VStack(alignment: .leading, spacing: 20) {
            Spacer()
            Text("When do you get paid?")
                .font(.title2.weight(.bold))
            Text("This sets the runway window — today through your next payday.")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            VStack(alignment: .leading, spacing: 8) {
                Text("How often").font(.subheadline.weight(.semibold))
                Picker("How often", selection: $vm.frequency) {
                    ForEach(PaydayFrequency.allCases) { Text($0.label).tag($0) }
                }
                .pickerStyle(.menu)
            }

            DatePicker(
                "Last payday",
                selection: $vm.lastPaycheckDate,
                in: ...Date(),
                displayedComponents: .date
            )

            Spacer()
            primaryButton("Continue") { await vm.savePayday() }
        }
    }

    private var connectBankStep: some View {
        VStack(spacing: 20) {
            Spacer()
            Image(systemName: "building.columns")
                .font(.system(size: 56))
                .foregroundStyle(.tint)
            Text("Next: connect your bank")
                .font(.title2.weight(.bold))
                .multilineTextAlignment(.center)
            Text("Linking your bank lets Nudget calculate your runway automatically. Bank connection is coming in the next update.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Spacer()
            Button("Finish for now") { onComplete() }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .frame(maxWidth: .infinity)
        }
    }

    // MARK: - Helpers

    private func bullet(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "checkmark.circle.fill").foregroundStyle(.green)
            Text(text)
        }
    }

    private func primaryButton(_ title: String, action: @escaping () async -> Void) -> some View {
        Button {
            Task { await action() }
        } label: {
            if vm.isWorking {
                ProgressView().frame(maxWidth: .infinity)
            } else {
                Text(title).frame(maxWidth: .infinity)
            }
        }
        .buttonStyle(.borderedProminent)
        .controlSize(.large)
        .disabled(vm.isWorking)
    }
}
