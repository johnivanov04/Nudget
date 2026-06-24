import SwiftUI

struct BillsView: View {
    @StateObject private var vm: BillsViewModel
    private let onClose: () -> Void
    @State private var editing: Bill?

    init(token: String, onClose: @escaping () -> Void) {
        _vm = StateObject(wrappedValue: BillsViewModel(token: token))
        self.onClose = onClose
    }

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Bills before payday")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Done") { onClose() }
                    }
                }
                .sheet(item: $editing) { bill in
                    EditBillSheet(bill: bill) { amount, nextDate in
                        Task { await vm.edit(bill, amount: amount, nextDate: nextDate) }
                    }
                }
        }
        .task { await vm.load() }
    }

    @ViewBuilder
    private var content: some View {
        if vm.isLoading {
            ProgressView()
        } else if vm.bills.isEmpty {
            ContentUnavailableView(
                "No bills detected yet",
                systemImage: "calendar.badge.clock",
                description: Text(vm.error ?? "As Nudget sees more of your spending, recurring bills will show up here for you to confirm.")
            )
        } else {
            List {
                if let error = vm.error {
                    Section { Text(error).foregroundStyle(.red).font(.footnote) }
                }
                Section {
                    ForEach(vm.bills) { bill in
                        row(bill)
                    }
                } footer: {
                    Text("Swipe a bill to confirm or remove it. Confirmed bills always count toward your runway; “likely” ones are Nudget’s best guess.")
                }
            }
        }
    }

    private func row(_ bill: Bill) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text(bill.displayName)
                HStack(spacing: 6) {
                    Text(Format.currency(bill.amountEstimate)).foregroundStyle(.primary)
                    if let cadence = bill.cadence { Text("· \(cadence)") }
                    if let date = bill.nextExpectedDate { Text("· \(Format.shortDate(date))") }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            Spacer()
            if vm.busyIds.contains(bill.id) {
                ProgressView()
            } else if bill.isConfirmed {
                Label("Confirmed", systemImage: "checkmark.seal.fill")
                    .labelStyle(.iconOnly)
                    .foregroundStyle(.green)
            } else {
                Text("Likely")
                    .font(.caption2.weight(.semibold))
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(.orange.opacity(0.15), in: Capsule())
                    .foregroundStyle(.orange)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { editing = bill }
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            Button(role: .destructive) {
                Task { await vm.reject(bill) }
            } label: {
                Label("Not a bill", systemImage: "xmark")
            }
            if !bill.isConfirmed {
                Button {
                    Task { await vm.confirm(bill) }
                } label: {
                    Label("Confirm", systemImage: "checkmark")
                }
                .tint(.green)
            }
        }
    }
}

/// Edit a bill's amount + next date, then confirm it.
private struct EditBillSheet: View {
    let bill: Bill
    let onSave: (Double, String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var amount: Double
    @State private var date: Date

    init(bill: Bill, onSave: @escaping (Double, String) -> Void) {
        self.bill = bill
        self.onSave = onSave
        _amount = State(initialValue: bill.amountEstimate)
        _date = State(initialValue: Self.parse(bill.nextExpectedDate) ?? Date())
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Amount") {
                    TextField("Amount", value: $amount, format: .currency(code: "USD"))
                        .keyboardType(.decimalPad)
                }
                Section("Next charge") {
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                }
            }
            .navigationTitle(bill.displayName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Confirm") {
                        onSave(amount, Self.format(date))
                        dismiss()
                    }
                }
            }
        }
    }

    private static func parse(_ iso: String?) -> Date? {
        guard let iso else { return nil }
        return formatter.date(from: iso)
    }
    private static func format(_ date: Date) -> String { formatter.string(from: date) }

    private static let formatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()
}
