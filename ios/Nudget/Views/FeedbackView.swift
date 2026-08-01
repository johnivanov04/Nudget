import SwiftUI

/// Beta feedback — the loop the spec requires: saved-fee moments (the key success
/// metric), nudge helpfulness, runway confusion, and anything else. Opened from
/// the dashboard menu and Settings.
struct FeedbackView: View {
    @StateObject private var vm: FeedbackViewModel
    private let onClose: () -> Void

    init(token: String, onClose: @escaping () -> Void) {
        _vm = StateObject(wrappedValue: FeedbackViewModel(token: token))
        self.onClose = onClose
    }

    var body: some View {
        NavigationStack {
            Group {
                if vm.didSend {
                    thankYou
                } else {
                    form
                }
            }
            .navigationTitle("Send feedback")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(vm.didSend ? "Done" : "Cancel") { onClose() }
                }
            }
        }
    }

    private var form: some View {
        Form {
            Section("What's this about?") {
                Picker("Topic", selection: $vm.topic) {
                    ForEach(FeedbackViewModel.Topic.allCases) { Text($0.label).tag($0) }
                }
                .pickerStyle(.inline)
                .labelsHidden()
            }

            if vm.topic.asksHelpful {
                Section("Was it helpful?") {
                    Picker("Helpful", selection: $vm.helpful) {
                        Text("Helpful").tag(true)
                        Text("Not helpful").tag(false)
                    }
                    .pickerStyle(.segmented)
                }
            }

            Section("Your note (optional)") {
                TextField("Tell us more…", text: $vm.note, axis: .vertical)
                    .lineLimit(3...6)
            }

            if let error = vm.error {
                Text(error).foregroundStyle(Theme.risk(.danger)).font(.footnote)
            }

            Section {
                Button {
                    Task { await vm.submit() }
                } label: {
                    if vm.isSending {
                        ProgressView().frame(maxWidth: .infinity)
                    } else {
                        Text("Send feedback").frame(maxWidth: .infinity).fontWeight(.semibold)
                    }
                }
                .disabled(vm.isSending)
            } footer: {
                Text("Feedback helps improve predictions and nudges. We never attach your raw transactions.")
            }
        }
    }

    private var thankYou: some View {
        ContentUnavailableView {
            Label(vm.topic == .savedFee ? "That's what we're here for 🎉" : "Thanks for the feedback",
                  systemImage: vm.topic == .savedFee ? "party.popper.fill" : "checkmark.seal.fill")
        } description: {
            Text("It helps make Nudget more accurate for you.")
        } actions: {
            Button("Done") { onClose() }
                .buttonStyle(.borderedProminent)
        }
    }
}
