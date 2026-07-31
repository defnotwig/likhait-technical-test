class Api::ExpensesController < ApplicationController
  def index
    expenses = Expense.includes(:category).order(date: :desc, created_at: :desc, id: :desc)

    if params[:year].present? || params[:month].present?
      date_range = requested_date_range
      return render_invalid_period unless date_range

      expenses = expenses.where(date: date_range)
    end

    render json: expenses.map { |expense| format_expense(expense) }
  end

  def create
    expense = Expense.new(expense_params)

    if expense.save
      render json: format_expense(expense), status: :created
    else
      render json: { errors: expense.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    expense = Expense.find(params[:id])

    if expense.update(expense_params)
      render json: format_expense(expense)
    else
      render json: { errors: expense.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    expense = Expense.find(params[:id])
    expense.destroy
    head :no_content
  end

  private

  def expense_params
    params.require(:expense).permit(:description, :amount, :category_id, :date)
  end

  def requested_date_range
    return unless params[:year].present? && params[:month].present?

    year = Integer(params[:year].to_s, 10)
    month = Integer(params[:month].to_s, 10)
    start_date = Date.new(year, month, 1)
    start_date..start_date.end_of_month
  rescue ArgumentError
    nil
  end

  def render_invalid_period
    render json: { errors: [ "Year and month must identify a valid calendar month" ] }, status: :unprocessable_entity
  end

  def format_expense(expense)
    {
      id: expense.id,
      description: expense.description,
      amount: expense.amount.to_f,
      category_id: expense.category_id,
      category: expense.category.name,
      date: expense.date.to_s,
      created_at: expense.created_at,
      updated_at: expense.updated_at
    }
  end
end
