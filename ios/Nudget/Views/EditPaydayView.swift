import SwiftUI

/// Edit the pay schedule after onboarding. Pushed from Settings. Saving persists
/// via the same paycheck endpoint (which recomputes the next payday + runway).
struct EditPaydayView: View {
    @StateObject private var vm: EditPaydayViewModel
    @Environment(\.dismiss) private var dismiss

    init(token: String) {
        _vm = StateObject(wrappedValue: EditPaydayViewModel(token: token))
    }

    var body: some View {
        Form {
            if vm.isLoading {
                ProgressView()
            } else {
                Section {
                    Picker("How often", selection: $vm.frequency) {
                        ForEach(PaydayFrequency.allCases) { Text($0.label).tag($0) }
                    }
                    DatePicker(
                        "Last payday",
                        selection: $vm.lastPaycheckDate,
                        in: ...Date(),
                        displayedComponents: .date
                    )
                } footer: {
                    Text("Nudget uses this to project your next payday and your safe-to-spend window.")
                }

                if let error = vm.error {
                    Text(error).foregroundStyle(Theme.risk(.danger)).font(.footnote)
                }
            }
        }
        .navigationTitle("Payday")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    Task { if await vm.save() { dismiss() } }
                }
                .disabled(vm.isLoading || vm.isSaving)
            }
        }
        .task { await vm.load() }
    }
}
