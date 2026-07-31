require 'rails_helper'

RSpec.describe "Api::Expenses", type: :request do
  let!(:food_category) { Category.create!(name: "Food") }
  let!(:transport_category) { Category.create!(name: "Transport") }
  let(:today) { Date.new(2026, 7, 31) }

  before do
    allow(Date).to receive(:current).and_return(today)
  end

  describe "GET /api/expenses" do
  let!(:expense1) { Expense.create!(description: "Lunch", amount: 100.00, category: food_category, date: Date.today) }
  let!(:expense2) { Expense.create!(description: "Taxi", amount: 50.00, category: transport_category, date: Date.today) }

    it "returns all expenses with category information" do
      get "/api/expenses"

      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json.length).to eq(2)
    end

    it "returns expenses in descending order by created_at" do
      get "/api/expenses"

      json = JSON.parse(response.body)
      expect(json.first["id"]).to eq(expense2.id)
      expect(json.last["id"]).to eq(expense1.id)
    end
  end

  describe "POST /api/expenses" do
    context "with valid parameters" do
      let(:valid_params) do
        {
          expense: {
            description: "Team Lunch",
            amount: 150.50,
            category_id: food_category.id,
            date: today
          }
        }
      end

      it "creates a new expense" do
        expect {
          post "/api/expenses", params: valid_params, as: :json
        }.to change(Expense, :count).by(1)

        expect(response).to have_http_status(:created)
        json = JSON.parse(response.body)
        expect(json["description"]).to eq("Team Lunch")
        expect(json["amount"]).to eq(150.5)
      end
    end

    context "with invalid parameters" do
      it "rejects negative amounts" do
        invalid_params = {
          expense: {
            description: "Invalid expense",
            amount: -100.00,
            category_id: food_category.id,
            date: today
          }
        }

        expect {
          post "/api/expenses", params: invalid_params, as: :json
        }.not_to change(Expense, :count)

        expect(response).to have_http_status(422)
        expect(JSON.parse(response.body)["errors"]).to include("Amount must be greater than 0")
      end

      it "rejects empty descriptions" do
        invalid_params = {
          expense: {
            description: "",
            amount: 100.00,
            category_id: food_category.id,
            date: today
          }
        }

        expect {
          post "/api/expenses", params: invalid_params, as: :json
        }.not_to change(Expense, :count)

        expect(response).to have_http_status(422)
        expect(JSON.parse(response.body)["errors"]).to include("Description can't be blank")
      end

      it "rejects a blank date" do
        post "/api/expenses", params: {
          expense: { description: "Missing date", amount: 10, category_id: food_category.id, date: "" }
        }, as: :json

        expect(response).to have_http_status(422)
        expect(JSON.parse(response.body)["errors"]).to include("Date can't be blank")
      end

      it "rejects a future date sent directly to the API" do
        expect {
          post "/api/expenses", params: {
            expense: {
              description: "Tomorrow",
              amount: 10,
              category_id: food_category.id,
              date: today + 1.day
            }
          }, as: :json
        }.not_to change(Expense, :count)

        expect(response).to have_http_status(422)
        expect(JSON.parse(response.body)["errors"]).to include("Date cannot be in the future")
      end
    end
  end

  describe "PUT /api/expenses/:id" do
    it "rejects moving an existing expense into the future" do
      expense = Expense.create!(
        description: "Existing",
        amount: 10,
        category: food_category,
        date: today
      )

      put "/api/expenses/#{expense.id}", params: {
        expense: { date: today + 1.day }
      }, as: :json

      expect(response).to have_http_status(422)
      expect(JSON.parse(response.body)["errors"]).to include("Date cannot be in the future")
      expect(expense.reload.date).to eq(today)
    end
  end
end
